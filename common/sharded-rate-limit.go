package common

import (
	"hash/fnv"
	"sync"
	"time"
)

const (
	// ShardCount is the number of shards for the rate limiter
	// 256 shards reduce lock contention to ~0.4% (1/256) of requests
	ShardCount = 256
)

// shard represents a single shard with its own lock and data
type shard struct {
	store map[string]*rateLimitEntry
	mutex sync.RWMutex
}

// rateLimitEntry stores timestamps for rate limiting
type rateLimitEntry struct {
	timestamps []int64
	lastAccess int64
}

// ShardedRateLimiter implements a high-performance rate limiter using sharding
// to reduce lock contention from 100% to 0.4% under high concurrency
type ShardedRateLimiter struct {
	shards             [ShardCount]*shard
	expirationDuration time.Duration
	initialized        bool
	initMutex          sync.Mutex
}

// Init initializes the sharded rate limiter
func (l *ShardedRateLimiter) Init(expirationDuration time.Duration) {
	if l.initialized {
		return
	}

	l.initMutex.Lock()
	defer l.initMutex.Unlock()

	if l.initialized {
		return
	}

	l.expirationDuration = expirationDuration

	for i := 0; i < ShardCount; i++ {
		l.shards[i] = &shard{
			store: make(map[string]*rateLimitEntry),
		}
	}

	if expirationDuration > 0 {
		// Start cleanup goroutines for each shard group
		// Using 16 cleanup workers to handle 256 shards (16 shards each)
		for i := 0; i < 16; i++ {
			go l.cleanupWorker(i)
		}
	}

	l.initialized = true
}

// getShard returns the shard for a given key using FNV-1a hash
func (l *ShardedRateLimiter) getShard(key string) *shard {
	h := fnv.New32a()
	h.Write([]byte(key))
	return l.shards[h.Sum32()%ShardCount]
}

// cleanupWorker periodically cleans expired entries from assigned shards
func (l *ShardedRateLimiter) cleanupWorker(workerID int) {
	ticker := time.NewTicker(l.expirationDuration)
	defer ticker.Stop()

	for range ticker.C {
		// Each worker handles 16 shards
		startShard := workerID * 16
		endShard := startShard + 16

		now := time.Now().Unix()
		expirationSeconds := int64(l.expirationDuration.Seconds())

		for i := startShard; i < endShard; i++ {
			l.cleanupShard(l.shards[i], now, expirationSeconds)
		}
	}
}

// cleanupShard removes expired entries from a single shard
func (l *ShardedRateLimiter) cleanupShard(s *shard, now, expirationSeconds int64) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	for key, entry := range s.store {
		// Remove if no access within expiration duration
		if now-entry.lastAccess > expirationSeconds {
			delete(s.store, key)
			continue
		}

		// Also remove entries with empty timestamps
		if len(entry.timestamps) == 0 {
			delete(s.store, key)
		}
	}
}

// Request checks if a request is allowed under the rate limit
// Returns true if the request is allowed, false otherwise
// maxRequestNum: maximum number of requests allowed
// duration: time window in seconds
func (l *ShardedRateLimiter) Request(key string, maxRequestNum int, duration int64) bool {
	s := l.getShard(key)
	now := time.Now().Unix()

	s.mutex.Lock()
	defer s.mutex.Unlock()

	entry, exists := s.store[key]
	if !exists {
		// First request for this key
		entry = &rateLimitEntry{
			timestamps: make([]int64, 0, maxRequestNum),
			lastAccess: now,
		}
		s.store[key] = entry
	}

	entry.lastAccess = now

	// Remove expired timestamps (outside the time window)
	windowStart := now - duration
	validIdx := 0
	for _, ts := range entry.timestamps {
		if ts > windowStart {
			entry.timestamps[validIdx] = ts
			validIdx++
		}
	}
	entry.timestamps = entry.timestamps[:validIdx]

	// Check if we're under the limit
	if len(entry.timestamps) < maxRequestNum {
		entry.timestamps = append(entry.timestamps, now)
		return true
	}

	return false
}

// RequestWithInfo returns detailed rate limit information
// Useful for setting rate limit headers
func (l *ShardedRateLimiter) RequestWithInfo(key string, maxRequestNum int, duration int64) (allowed bool, remaining int, resetAt int64) {
	s := l.getShard(key)
	now := time.Now().Unix()

	s.mutex.Lock()
	defer s.mutex.Unlock()

	entry, exists := s.store[key]
	if !exists {
		entry = &rateLimitEntry{
			timestamps: make([]int64, 0, maxRequestNum),
			lastAccess: now,
		}
		s.store[key] = entry
	}

	entry.lastAccess = now

	// Remove expired timestamps
	windowStart := now - duration
	validIdx := 0
	oldestTimestamp := now
	for _, ts := range entry.timestamps {
		if ts > windowStart {
			entry.timestamps[validIdx] = ts
			validIdx++
			if ts < oldestTimestamp {
				oldestTimestamp = ts
			}
		}
	}
	entry.timestamps = entry.timestamps[:validIdx]

	// Calculate reset time
	if len(entry.timestamps) > 0 {
		resetAt = oldestTimestamp + duration
	} else {
		resetAt = now + duration
	}

	// Check if we're under the limit
	if len(entry.timestamps) < maxRequestNum {
		entry.timestamps = append(entry.timestamps, now)
		return true, maxRequestNum - len(entry.timestamps), resetAt
	}

	return false, 0, resetAt
}

// GetStats returns statistics about the rate limiter
func (l *ShardedRateLimiter) GetStats() map[string]int {
	stats := make(map[string]int)
	totalKeys := 0

	for i := 0; i < ShardCount; i++ {
		s := l.shards[i]
		s.mutex.RLock()
		totalKeys += len(s.store)
		s.mutex.RUnlock()
	}

	stats["total_keys"] = totalKeys
	stats["shard_count"] = ShardCount

	return stats
}

// Clear removes all entries from the rate limiter
func (l *ShardedRateLimiter) Clear() {
	for i := 0; i < ShardCount; i++ {
		s := l.shards[i]
		s.mutex.Lock()
		s.store = make(map[string]*rateLimitEntry)
		s.mutex.Unlock()
	}
}

// Global sharded rate limiter instance
var shardedInMemoryRateLimiter ShardedRateLimiter

// GetShardedRateLimiter returns the global sharded rate limiter
func GetShardedRateLimiter() *ShardedRateLimiter {
	return &shardedInMemoryRateLimiter
}
