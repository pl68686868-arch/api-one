package common

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"strconv"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/songquanpeng/one-api/common/logger"
)

// Lua scripts for atomic Redis operations
// These scripts reduce multiple RTTs to a single RTT

// slidingWindowRateLimitScript implements sliding window rate limiting in a single atomic operation
// KEYS[1]: the rate limit key
// ARGV[1]: current timestamp in milliseconds
// ARGV[2]: window size in milliseconds
// ARGV[3]: max requests allowed
// Returns: {allowed (0/1), remaining, reset_at_ms}
const slidingWindowRateLimitScript = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max_requests = tonumber(ARGV[3])

-- Remove old entries outside the window
local window_start = now - window
redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

-- Count current requests in window
local current_count = redis.call('ZCARD', key)

-- Get oldest entry for reset time calculation
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local reset_at = now + window
if #oldest > 0 then
    reset_at = tonumber(oldest[2]) + window
end

-- Check if under limit
if current_count < max_requests then
    -- Add new request
    redis.call('ZADD', key, now, now .. ':' .. math.random(1000000))
    -- Set expiry on the key
    redis.call('PEXPIRE', key, window + 1000)
    return {1, max_requests - current_count - 1, reset_at}
else
    return {0, 0, reset_at}
end
`

// tokenBucketRateLimitScript implements token bucket rate limiting
// KEYS[1]: the rate limit key
// ARGV[1]: current timestamp in seconds
// ARGV[2]: bucket capacity (max tokens)
// ARGV[3]: refill rate (tokens per second)
// ARGV[4]: tokens to consume
// Returns: {allowed (0/1), remaining_tokens, next_refill_at}
const tokenBucketRateLimitScript = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refill_rate = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

-- Get current bucket state
local bucket = redis.call('HMGET', key, 'tokens', 'last_update')
local tokens = tonumber(bucket[1])
local last_update = tonumber(bucket[2])

-- Initialize if not exists
if tokens == nil then
    tokens = capacity
    last_update = now
end

-- Refill tokens based on time elapsed
local elapsed = now - last_update
local refill = elapsed * refill_rate
tokens = math.min(capacity, tokens + refill)

-- Try to consume tokens
if tokens >= requested then
    tokens = tokens - requested
    redis.call('HMSET', key, 'tokens', tokens, 'last_update', now)
    redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) + 10)
    return {1, math.floor(tokens), now + math.ceil(requested / refill_rate)}
else
    redis.call('HMSET', key, 'tokens', tokens, 'last_update', now)
    redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) + 10)
    local wait_time = math.ceil((requested - tokens) / refill_rate)
    return {0, math.floor(tokens), now + wait_time}
end
`

// decrementQuotaScript atomically decrements user quota
// KEYS[1]: the quota key
// ARGV[1]: amount to decrement
// ARGV[2]: minimum allowed value (to prevent negative values in certain cases)
// Returns: {new_value, was_updated (0/1)}
const decrementQuotaScript = `
local key = KEYS[1]
local decrement = tonumber(ARGV[1])
local min_value = tonumber(ARGV[2])

local current = tonumber(redis.call('GET', key))
if current == nil then
    return {-1, 0}
end

local new_value = current - decrement
if new_value < min_value then
    return {current, 0}
end

redis.call('DECRBY', key, decrement)
return {new_value, 1}
`

// RedisScriptManager manages Lua scripts with caching
type RedisScriptManager struct {
	scripts     map[string]string
	scriptSHAs  map[string]string
	mu          sync.RWMutex
	initialized bool
}

var (
	scriptManager     *RedisScriptManager
	scriptManagerOnce sync.Once
)

// GetScriptManager returns the singleton script manager
func GetScriptManager() *RedisScriptManager {
	scriptManagerOnce.Do(func() {
		scriptManager = &RedisScriptManager{
			scripts:    make(map[string]string),
			scriptSHAs: make(map[string]string),
		}
		scriptManager.registerBuiltinScripts()
	})
	return scriptManager
}

// registerBuiltinScripts registers all built-in Lua scripts
func (m *RedisScriptManager) registerBuiltinScripts() {
	m.scripts["sliding_window_rate_limit"] = slidingWindowRateLimitScript
	m.scripts["token_bucket_rate_limit"] = tokenBucketRateLimitScript
	m.scripts["decrement_quota"] = decrementQuotaScript
}

// calculateSHA1 calculates the SHA1 hash of a script
func calculateSHA1(script string) string {
	h := sha1.New()
	h.Write([]byte(script))
	return hex.EncodeToString(h.Sum(nil))
}

// LoadScripts loads all scripts to Redis and caches their SHAs
func (m *RedisScriptManager) LoadScripts(ctx context.Context) error {
	if !RedisEnabled {
		return nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	for name, script := range m.scripts {
		sha, err := RDB.ScriptLoad(ctx, script).Result()
		if err != nil {
			logger.SysError("Failed to load script " + name + ": " + err.Error())
			// Calculate SHA locally as fallback
			sha = calculateSHA1(script)
		}
		m.scriptSHAs[name] = sha
	}

	m.initialized = true
	return nil
}

// GetScriptSHA returns the SHA of a script, loading if necessary
func (m *RedisScriptManager) GetScriptSHA(ctx context.Context, name string) (string, error) {
	m.mu.RLock()
	sha, exists := m.scriptSHAs[name]
	m.mu.RUnlock()

	if exists {
		return sha, nil
	}

	// Try to load scripts if not initialized
	if !m.initialized {
		if err := m.LoadScripts(ctx); err != nil {
			return "", err
		}
		m.mu.RLock()
		sha = m.scriptSHAs[name]
		m.mu.RUnlock()
	}

	return sha, nil
}

// RunScript executes a script by name, falling back to EVAL if EVALSHA fails
func (m *RedisScriptManager) RunScript(ctx context.Context, name string, keys []string, args ...interface{}) *redis.Cmd {
	sha, err := m.GetScriptSHA(ctx, name)
	if err != nil || sha == "" {
		// Fallback to EVAL
		m.mu.RLock()
		script := m.scripts[name]
		m.mu.RUnlock()
		return RDB.Eval(ctx, script, keys, args...)
	}

	// Try EVALSHA first
	result := RDB.EvalSha(ctx, sha, keys, args...)
	if result.Err() != nil && isNoScriptError(result.Err()) {
		// Script not loaded, reload and retry
		m.mu.RLock()
		script := m.scripts[name]
		m.mu.RUnlock()

		// Reload script
		newSha, loadErr := RDB.ScriptLoad(ctx, script).Result()
		if loadErr == nil {
			m.mu.Lock()
			m.scriptSHAs[name] = newSha
			m.mu.Unlock()
		}

		// Retry with EVAL
		return RDB.Eval(ctx, script, keys, args...)
	}

	return result
}

// isNoScriptError checks if the error is a NOSCRIPT error
func isNoScriptError(err error) bool {
	if err == nil {
		return false
	}
	return err.Error() == "NOSCRIPT No matching script. Please use EVAL." ||
		(len(err.Error()) >= 8 && err.Error()[:8] == "NOSCRIPT")
}

// RateLimitResult holds the result of a rate limit check
type RateLimitResult struct {
	Allowed   bool
	Remaining int
	ResetAt   time.Time
}

// SlidingWindowRateLimit performs atomic sliding window rate limiting using Redis Lua script
func SlidingWindowRateLimit(ctx context.Context, key string, maxRequests int, window time.Duration) (*RateLimitResult, error) {
	if !RedisEnabled {
		return &RateLimitResult{Allowed: true, Remaining: maxRequests - 1}, nil
	}

	nowMs := time.Now().UnixMilli()
	windowMs := window.Milliseconds()

	result, err := GetScriptManager().RunScript(
		ctx,
		"sliding_window_rate_limit",
		[]string{"ratelimit:" + key},
		nowMs,
		windowMs,
		maxRequests,
	).Result()

	if err != nil {
		logger.SysError("SlidingWindowRateLimit script error: " + err.Error())
		// On error, allow the request (fail open)
		return &RateLimitResult{Allowed: true, Remaining: maxRequests - 1}, nil
	}

	// Parse result
	arr, ok := result.([]interface{})
	if !ok || len(arr) < 3 {
		return &RateLimitResult{Allowed: true, Remaining: maxRequests - 1}, nil
	}

	allowed := toInt64(arr[0]) == 1
	remaining := int(toInt64(arr[1]))
	resetAtMs := toInt64(arr[2])

	return &RateLimitResult{
		Allowed:   allowed,
		Remaining: remaining,
		ResetAt:   time.UnixMilli(resetAtMs),
	}, nil
}

// TokenBucketRateLimit performs token bucket rate limiting using Redis Lua script
func TokenBucketRateLimit(ctx context.Context, key string, capacity int, refillRate float64, tokens int) (*RateLimitResult, error) {
	if !RedisEnabled {
		return &RateLimitResult{Allowed: true, Remaining: capacity - tokens}, nil
	}

	now := time.Now().Unix()

	result, err := GetScriptManager().RunScript(
		ctx,
		"token_bucket_rate_limit",
		[]string{"tokenbucket:" + key},
		now,
		capacity,
		refillRate,
		tokens,
	).Result()

	if err != nil {
		logger.SysError("TokenBucketRateLimit script error: " + err.Error())
		return &RateLimitResult{Allowed: true, Remaining: capacity - tokens}, nil
	}

	arr, ok := result.([]interface{})
	if !ok || len(arr) < 3 {
		return &RateLimitResult{Allowed: true, Remaining: capacity - tokens}, nil
	}

	allowed := toInt64(arr[0]) == 1
	remaining := int(toInt64(arr[1]))
	resetAt := toInt64(arr[2])

	return &RateLimitResult{
		Allowed:   allowed,
		Remaining: remaining,
		ResetAt:   time.Unix(resetAt, 0),
	}, nil
}

// AtomicDecrementQuota atomically decrements quota using Lua script
func AtomicDecrementQuota(ctx context.Context, key string, amount int64, minValue int64) (int64, bool, error) {
	if !RedisEnabled {
		return 0, false, nil
	}

	result, err := GetScriptManager().RunScript(
		ctx,
		"decrement_quota",
		[]string{key},
		amount,
		minValue,
	).Result()

	if err != nil {
		return 0, false, err
	}

	arr, ok := result.([]interface{})
	if !ok || len(arr) < 2 {
		return 0, false, nil
	}

	newValue := toInt64(arr[0])
	wasUpdated := toInt64(arr[1]) == 1

	return newValue, wasUpdated, nil
}

// toInt64 converts interface{} to int64
func toInt64(v interface{}) int64 {
	switch val := v.(type) {
	case int64:
		return val
	case int:
		return int64(val)
	case float64:
		return int64(val)
	case string:
		i, _ := strconv.ParseInt(val, 10, 64)
		return i
	default:
		return 0
	}
}

// InitRedisScripts initializes Redis scripts on startup
func InitRedisScripts() error {
	if !RedisEnabled {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	return GetScriptManager().LoadScripts(ctx)
}
