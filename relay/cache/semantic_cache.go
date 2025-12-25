package cache

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/songquanpeng/one-api/common"
	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/logger"
	relaymodel "github.com/songquanpeng/one-api/relay/model"
)

// SemanticCache implements vector-based similarity caching
// Uses local text hashing for embeddings (no external API needed)
type SemanticCache struct {
	enabled   bool
	threshold float64 // Similarity threshold (0.0-1.0)
	maxSize   int     // Maximum cache entries
	
	// In-memory vector store
	vectors   map[string]*VectorEntry
	mu        sync.RWMutex
}

// VectorEntry represents a cached vector with metadata
type VectorEntry struct {
	Vector    []float64 `json:"vector"`
	Response  string    `json:"response"`
	Model     string    `json:"model"`
	Query     string    `json:"query"` // Original query for debugging
	Tokens    int       `json:"tokens"`
	Created   int64     `json:"created"`
	HitCount  int       `json:"hit_count"`
}

var globalSemanticCache *SemanticCache
var semanticOnce sync.Once

// InitSemanticCache initializes the semantic cache
func InitSemanticCache() {
	semanticOnce.Do(func() {
		globalSemanticCache = &SemanticCache{
			enabled:   config.SemanticCacheEnabled,
			threshold: config.SemanticCacheThreshold,
			maxSize:   config.SemanticCacheMaxSize,
			vectors:   make(map[string]*VectorEntry),
		}
		
		// Load from Redis if available
		if common.RedisEnabled {
			globalSemanticCache.loadFromRedis()
		}
		
		logger.SysLog(fmt.Sprintf("Semantic cache initialized (threshold: %.2f, max_size: %d)", 
			globalSemanticCache.threshold, globalSemanticCache.maxSize))
	})
}

// GetSemanticCache returns the global semantic cache instance
func GetSemanticCache() *SemanticCache {
	if globalSemanticCache == nil {
		InitSemanticCache()
	}
	return globalSemanticCache
}

// CheckSemantic looks for semantically similar cached responses
// Returns (cached_response, similarity_score, found)
func (sc *SemanticCache) CheckSemantic(
	model string,
	messages []relaymodel.Message,
) (string, float64, bool) {
	if sc == nil || !sc.enabled {
		return "", 0, false
	}
	
	// Extract query text from messages
	query := extractQueryText(messages)
	if query == "" {
		return "", 0, false
	}
	
	// Generate embedding for query
	queryVector := sc.generateEmbedding(query)
	
	// Search for similar vectors
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	
	var bestMatch *VectorEntry
	var bestScore float64
	
	for _, entry := range sc.vectors {
		// Only match same model family (gpt-4 can use gpt-4o cache, etc)
		if !isSameModelFamily(model, entry.Model) {
			continue
		}
		
		score := cosineSimilarity(queryVector, entry.Vector)
		if score > bestScore {
			bestScore = score
			bestMatch = entry
		}
	}
	
	// Check if similarity exceeds threshold
	if bestScore >= sc.threshold && bestMatch != nil {
		// Update hit count
		bestMatch.HitCount++
		CacheMetrics.RecordHit()
		CacheMetrics.AddTokensSaved(bestMatch.Tokens)
		
		logger.SysLog(fmt.Sprintf("[SEMANTIC HIT] score=%.3f query='%s...'", 
			bestScore, truncate(query, 50)))
		
		return bestMatch.Response, bestScore, true
	}
	
	return "", bestScore, false
}

// StoreSemantic stores a response with its semantic embedding
func (sc *SemanticCache) StoreSemantic(
	model string,
	messages []relaymodel.Message,
	response string,
	tokens int,
) error {
	if sc == nil || !sc.enabled {
		return nil
	}
	
	query := extractQueryText(messages)
	if query == "" {
		return nil
	}
	
	// Generate embedding
	vector := sc.generateEmbedding(query)
	
	// Create cache key from vector hash
	key := sc.vectorKey(vector)
	
	sc.mu.Lock()
	defer sc.mu.Unlock()
	
	// Evict old entries if cache is full
	if len(sc.vectors) >= sc.maxSize {
		sc.evictLRU()
	}
	
	// Store entry
	sc.vectors[key] = &VectorEntry{
		Vector:   vector,
		Response: response,
		Model:    model,
		Query:    truncate(query, 200),
		Tokens:   tokens,
		Created:  time.Now().Unix(),
		HitCount: 0,
	}
	
	// Persist to Redis asynchronously
	if common.RedisEnabled {
		go sc.persistToRedis(key, sc.vectors[key])
	}
	
	return nil
}

// generateEmbedding generates a simple embedding vector from text
// Uses character n-gram hashing - no external API needed
// This is simpler than neural embeddings but works well for exact/near-exact matches
func (sc *SemanticCache) generateEmbedding(text string) []float64 {
	// Normalize text
	text = strings.ToLower(strings.TrimSpace(text))
	
	// Vector dimension (256 is good balance of speed vs accuracy)
	const dim = 256
	vector := make([]float64, dim)
	
	// Character n-grams (2-4 chars)
	for n := 2; n <= 4; n++ {
		for i := 0; i <= len(text)-n; i++ {
			ngram := text[i : i+n]
			hash := hashString(ngram)
			idx := hash % uint64(dim)
			vector[idx] += 1.0 / float64(n) // Weight by n-gram size
		}
	}
	
	// Word-level features
	words := strings.Fields(text)
	for _, word := range words {
		hash := hashString(word)
		idx := hash % uint64(dim)
		vector[idx] += 2.0 // Higher weight for whole words
	}
	
	// Normalize to unit vector
	normalize(vector)
	
	return vector
}

// vectorKey creates a cache key from vector hash
func (sc *SemanticCache) vectorKey(vector []float64) string {
	data, _ := json.Marshal(vector)
	hash := sha256.Sum256(data)
	return fmt.Sprintf("%x", hash[:16]) // First 16 bytes
}

// evictLRU evicts least recently used entries
func (sc *SemanticCache) evictLRU() {
	if len(sc.vectors) == 0 {
		return
	}
	
	// Find entry with oldest creation time and lowest hit count
	type scored struct {
		key   string
		score float64
	}
	
	entries := make([]scored, 0, len(sc.vectors))
	for key, entry := range sc.vectors {
		// Score = age_hours - (hit_count * 10)
		age := float64(time.Now().Unix()-entry.Created) / 3600.0
		score := age - float64(entry.HitCount)*10
		entries = append(entries, scored{key, score})
	}
	
	// Sort by score descending (higher = evict first)
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].score > entries[j].score
	})
	
	// Evict top 10%
	evictCount := len(entries) / 10
	if evictCount < 1 {
		evictCount = 1
	}
	
	for i := 0; i < evictCount && i < len(entries); i++ {
		delete(sc.vectors, entries[i].key)
	}
}

// loadFromRedis loads cached vectors from Redis
func (sc *SemanticCache) loadFromRedis() {
	if !common.RedisEnabled {
		return
	}
	
	// Load vector index from Redis
	data, err := common.RedisGet("llm:semantic:index")
	if err != nil {
		return
	}
	
	var keys []string
	if err := json.Unmarshal([]byte(data), &keys); err != nil {
		return
	}
	
	for _, key := range keys {
		entryData, err := common.RedisGet("llm:semantic:" + key)
		if err != nil {
			continue
		}
		
		var entry VectorEntry
		if err := json.Unmarshal([]byte(entryData), &entry); err != nil {
			continue
		}
		
		sc.vectors[key] = &entry
	}
	
	logger.SysLog(fmt.Sprintf("Loaded %d semantic cache entries from Redis", len(sc.vectors)))
}

// persistToRedis saves a vector entry to Redis
func (sc *SemanticCache) persistToRedis(key string, entry *VectorEntry) {
	if !common.RedisEnabled {
		return
	}
	
	data, err := json.Marshal(entry)
	if err != nil {
		return
	}
	
	// Store entry
	common.RedisSet("llm:semantic:"+key, string(data), 24*time.Hour)
	
	// Update index
	sc.mu.RLock()
	keys := make([]string, 0, len(sc.vectors))
	for k := range sc.vectors {
		keys = append(keys, k)
	}
	sc.mu.RUnlock()
	
	indexData, _ := json.Marshal(keys)
	common.RedisSet("llm:semantic:index", string(indexData), 24*time.Hour)
}

// GetStats returns semantic cache statistics
func (sc *SemanticCache) GetStats() map[string]interface{} {
	if sc == nil {
		return map[string]interface{}{}
	}
	
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	
	totalHits := 0
	for _, entry := range sc.vectors {
		totalHits += entry.HitCount
	}
	
	return map[string]interface{}{
		"enabled":   sc.enabled,
		"threshold": sc.threshold,
		"entries":   len(sc.vectors),
		"max_size":  sc.maxSize,
		"total_hits": totalHits,
	}
}

// Helper functions

// extractQueryText extracts user query from messages
func extractQueryText(messages []relaymodel.Message) string {
	if len(messages) == 0 {
		return ""
	}
	
	var query strings.Builder
	
	// Get last user message (most important)
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == "user" {
			content := messages[i].StringContent()
			if content != "" {
				query.WriteString(content)
				break
			}
		}
	}
	
	return query.String()
}

// isSameModelFamily checks if models are compatible for cache sharing
func isSameModelFamily(model1, model2 string) bool {
	// Extract family prefix
	family1 := extractModelFamily(model1)
	family2 := extractModelFamily(model2)
	return family1 == family2
}

// extractModelFamily extracts the model family from model name
func extractModelFamily(model string) string {
	model = strings.ToLower(model)
	
	// Common model families
	if strings.Contains(model, "gpt-4") {
		return "gpt4"
	}
	if strings.Contains(model, "gpt-3.5") {
		return "gpt35"
	}
	if strings.Contains(model, "claude") {
		return "claude"
	}
	if strings.Contains(model, "gemini") {
		return "gemini"
	}
	if strings.Contains(model, "llama") {
		return "llama"
	}
	if strings.Contains(model, "mistral") {
		return "mistral"
	}
	
	// Default: first word
	parts := strings.Split(model, "-")
	if len(parts) > 0 {
		return parts[0]
	}
	return model
}

// cosineSimilarity calculates cosine similarity between two vectors
func cosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) {
		return 0
	}
	
	var dot, magA, magB float64
	for i := range a {
		dot += a[i] * b[i]
		magA += a[i] * a[i]
		magB += b[i] * b[i]
	}
	
	if magA == 0 || magB == 0 {
		return 0
	}
	
	return dot / (math.Sqrt(magA) * math.Sqrt(magB))
}

// normalize normalizes a vector to unit length
func normalize(v []float64) {
	var mag float64
	for _, val := range v {
		mag += val * val
	}
	
	if mag == 0 {
		return
	}
	
	mag = math.Sqrt(mag)
	for i := range v {
		v[i] /= mag
	}
}

// hashString hashes a string using FNV-1a
func hashString(s string) uint64 {
	const (
		offset64 = 14695981039346656037
		prime64  = 1099511628211
	)
	
	hash := uint64(offset64)
	for i := 0; i < len(s); i++ {
		hash ^= uint64(s[i])
		hash *= prime64
	}
	return hash
}

// truncate truncates a string to max length
func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
