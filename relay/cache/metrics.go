package cache

import (
	"sync/atomic"
)

// cacheMetrics tracks cache performance
type cacheMetrics struct {
	hits        int64
	misses      int64
	tokensSaved int64
}

// CacheMetrics is the global metrics instance
var CacheMetrics = &cacheMetrics{}

// RecordHit increments cache hit counter
func (m *cacheMetrics) RecordHit() {
	atomic.AddInt64(&m.hits, 1)
}

// RecordMiss increments cache miss counter
func (m *cacheMetrics) RecordMiss() {
	atomic.AddInt64(&m.misses, 1)
}

// AddTokensSaved adds tokens saved by cache hit
func (m *cacheMetrics) AddTokensSaved(tokens int) {
	atomic.AddInt64(&m.tokensSaved, int64(tokens))
}

// GetHitRate returns cache hit rate (0.0-1.0)
func (m *cacheMetrics) GetHitRate() float64 {
	hits := atomic.LoadInt64(&m.hits)
	misses := atomic.LoadInt64(&m.misses)
	total := hits + misses

	if total == 0 {
		return 0.0
	}

	return float64(hits) / float64(total)
}

// GetStats returns current cache statistics
func (m *cacheMetrics) GetStats() map[string]interface{} {
	hits := atomic.LoadInt64(&m.hits)
	misses := atomic.LoadInt64(&m.misses)
	tokensSaved := atomic.LoadInt64(&m.tokensSaved)

	return map[string]interface{}{
		"hits":          hits,
		"misses":        misses,
		"total":         hits + misses,
		"hit_rate":      m.GetHitRate(),
		"tokens_saved":  tokensSaved,
	}
}

// Reset resets all metrics (useful for testing)
func (m *cacheMetrics) Reset() {
	atomic.StoreInt64(&m.hits, 0)
	atomic.StoreInt64(&m.misses, 0)
	atomic.StoreInt64(&m.tokensSaved, 0)
}
