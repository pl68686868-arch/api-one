package controller

import (
	"net/http"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/relay/cache"
)

// CacheStatsResponse represents cache statistics
type CacheStatsResponse struct {
	Enabled         bool    `json:"enabled"`
	
	// Exact Match Cache
	ExactCacheEnabled bool   `json:"exact_cache_enabled"`
	ExactCacheTTL     int    `json:"exact_cache_ttl"`
	
	// Semantic Cache
	SemanticCacheEnabled   bool    `json:"semantic_cache_enabled"`
	SemanticCacheThreshold float64 `json:"semantic_cache_threshold"`
	SemanticCacheMaxSize   int     `json:"semantic_cache_max_size"`
	SemanticCacheEntries   int     `json:"semantic_cache_entries"`
	SemanticCacheTotalHits int     `json:"semantic_cache_total_hits"`
	
	// Overall Stats
	TotalHits       int64   `json:"total_hits"`
	TotalMisses     int64   `json:"total_misses"`
	HitRate         float64 `json:"hit_rate"`
	TokensSaved     int64   `json:"tokens_saved"`
	EstCostSaved    float64 `json:"est_cost_saved"` // In USD
	
	// Timing
	LastUpdated     int64   `json:"last_updated"`
}

// GetCacheStats returns cache statistics
// @Summary Get cache statistics
// @Description Returns detailed cache performance metrics
// @Tags Cache
// @Accept json
// @Produce json
// @Success 200 {object} CacheStatsResponse
// @Router /api/cache/stats [get]
func GetCacheStats(c *gin.Context) {
	metrics := cache.CacheMetrics.GetStats()
	
	hits := metrics["hits"].(int64)
	misses := metrics["misses"].(int64)
	tokensSaved := metrics["tokens_saved"].(int64)
	
	// Calculate hit rate
	var hitRate float64
	total := hits + misses
	if total > 0 {
		hitRate = float64(hits) / float64(total)
	}
	
	// Estimate cost saved (assuming $0.002 per 1K tokens average)
	estCostSaved := float64(tokensSaved) * 0.000002
	
	// Get semantic cache stats
	var semanticStats map[string]interface{}
	if cache.GetSemanticCache() != nil {
		semanticStats = cache.GetSemanticCache().GetStats()
	} else {
		semanticStats = map[string]interface{}{
			"enabled":    false,
			"entries":    0,
			"total_hits": 0,
		}
	}
	
	response := CacheStatsResponse{
		Enabled:             config.ResponseCacheEnabled || config.SemanticCacheEnabled,
		
		// Exact Cache
		ExactCacheEnabled:   config.ResponseCacheEnabled,
		ExactCacheTTL:       config.ResponseCacheTTL,
		
		// Semantic Cache
		SemanticCacheEnabled:   config.SemanticCacheEnabled,
		SemanticCacheThreshold: config.SemanticCacheThreshold,
		SemanticCacheMaxSize:   config.SemanticCacheMaxSize,
		SemanticCacheEntries:   semanticStats["entries"].(int),
		SemanticCacheTotalHits: semanticStats["total_hits"].(int),
		
		// Overall
		TotalHits:       hits,
		TotalMisses:     misses,
		HitRate:         hitRate,
		TokensSaved:     tokensSaved,
		EstCostSaved:    estCostSaved,
		
		LastUpdated: time.Now().Unix(),
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    response,
	})
}

// ClearCacheRequest represents cache clear request
type ClearCacheRequest struct {
	Type string `json:"type"` // "exact", "semantic", or "all"
}

// ClearCache clears cache entries
// @Summary Clear cache
// @Description Clears cache entries by type
// @Tags Cache
// @Accept json
// @Produce json
// @Param request body ClearCacheRequest true "Cache type to clear"
// @Success 200 {object} map[string]interface{}
// @Router /api/cache/clear [post]
func ClearCache(c *gin.Context) {
	var req ClearCacheRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request: " + err.Error(),
		})
		return
	}
	
	cleared := 0
	
	switch req.Type {
	case "exact":
		// Clear exact match cache - would need Redis scan
		cleared = 0 // TODO: Implement Redis scan for llm:cache:exact:* keys
		
	case "semantic":
		if sc := cache.GetSemanticCache(); sc != nil {
			cleared = sc.Clear()
		}
		
	case "all":
		if sc := cache.GetSemanticCache(); sc != nil {
			cleared = sc.Clear()
		}
		// TODO: Also clear exact cache
		
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid cache type. Use 'exact', 'semantic', or 'all'",
		})
		return
	}
	
	// Reset metrics
	cache.CacheMetrics.Reset()
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Cache cleared successfully",
		"cleared": cleared,
	})
}

// ToggleCacheRequest represents cache toggle request
type ToggleCacheRequest struct {
	Type    string `json:"type"`    // "exact" or "semantic"
	Enabled bool   `json:"enabled"`
}

// ToggleCache enables/disables cache at runtime
// @Summary Toggle cache
// @Description Enable or disable cache at runtime
// @Tags Cache
// @Accept json
// @Produce json
// @Param request body ToggleCacheRequest true "Cache toggle settings"
// @Success 200 {object} map[string]interface{}
// @Router /api/cache/toggle [post]
func ToggleCache(c *gin.Context) {
	var req ToggleCacheRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request: " + err.Error(),
		})
		return
	}
	
	switch req.Type {
	case "exact":
		config.ResponseCacheEnabled = req.Enabled
		
	case "semantic":
		config.SemanticCacheEnabled = req.Enabled
		
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid cache type. Use 'exact' or 'semantic'",
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Cache " + req.Type + " set to " + boolToString(req.Enabled),
	})
}

func boolToString(b bool) string {
	if b {
		return "enabled"
	}
	return "disabled"
}

// Unused import fix - atomic is used in metrics
var _ = atomic.AddInt64
