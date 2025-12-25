package cache

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/songquanpeng/one-api/common"
	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/logger"
	relaymodel "github.com/songquanpeng/one-api/relay/model"
)

// ResponseCache manages LLM response caching
type ResponseCache struct {
	enabled bool
	ttl     time.Duration
}

// CachedResponse represents a cached LLM response
type CachedResponse struct {
	Content    string `json:"content"`
	Model      string `json:"model"`
	Created    int64  `json:"created"`
	TokensUsed int    `json:"tokens_used"`
}

var globalCache *ResponseCache
var cacheOnce sync.Once

// InitResponseCache initializes the global response cache
func InitResponseCache() {
	cacheOnce.Do(func() {
		globalCache = &ResponseCache{
			enabled: config.ResponseCacheEnabled,
			ttl:     time.Duration(config.ResponseCacheTTL) * time.Second,
		}
		logger.SysLog("Response cache initialized")
	})
}

// GetCache returns the global cache instance (thread-safe)
func GetCache() *ResponseCache {
	if globalCache == nil {
		InitResponseCache()
	}
	return globalCache
}

// CheckCache looks for exact match in cache
// Returns cached content and true if found, empty string and false otherwise
func (rc *ResponseCache) CheckCache(
	model string,
	messages []relaymodel.Message,
) (string, bool) {
	// Nil check for safety
	if rc == nil || !rc.enabled || !common.RedisEnabled {
		return "", false
	}

	key := rc.generateKey(model, messages)
	data, err := common.RedisGet("llm:cache:exact:" + key)

	if err != nil {
		CacheMetrics.RecordMiss()
		return "", false
	}

	// Parse cached response
	var cached CachedResponse
	if err := json.Unmarshal([]byte(data), &cached); err != nil {
		logger.SysError("Failed to unmarshal cached response: " + err.Error())
		CacheMetrics.RecordMiss()
		return "", false
	}

	// Update metrics
	CacheMetrics.RecordHit()
	CacheMetrics.AddTokensSaved(cached.TokensUsed)

	return cached.Content, true
}

// StoreCache stores successful response in cache
func (rc *ResponseCache) StoreCache(
	model string,
	messages []relaymodel.Message,
	responseContent string,
	tokensUsed int,
) error {
	if !rc.enabled || !common.RedisEnabled {
		return nil
	}

	key := rc.generateKey(model, messages)

	cached := CachedResponse{
		Content:    responseContent,
		Model:      model,
		Created:    time.Now().Unix(),
		TokensUsed: tokensUsed,
	}

	data, err := json.Marshal(cached)
	if err != nil {
		return err
	}

	return common.RedisSet(
		"llm:cache:exact:"+key,
		string(data),
		rc.ttl,
	)
}

// InvalidateCache removes a specific cache entry
func (rc *ResponseCache) InvalidateCache(
	model string,
	messages []relaymodel.Message,
) error {
	if !common.RedisEnabled {
		return nil
	}

	key := rc.generateKey(model, messages)
	return common.RedisDel("llm:cache:exact:" + key)
}

// generateKey creates a unique hash for the request
func (rc *ResponseCache) generateKey(
	model string,
	messages []relaymodel.Message,
) string {
	// Create deterministic JSON representation
	data, _ := json.Marshal(map[string]interface{}{
		"model":    model,
		"messages": messages,
	})

	hash := sha256.Sum256(data)
	return fmt.Sprintf("%x", hash)
}

// IsEnabled returns whether caching is enabled
func (rc *ResponseCache) IsEnabled() bool {
	return rc.enabled
}
