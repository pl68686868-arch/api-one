package middleware

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/songquanpeng/one-api/common"
	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/logger"
)

// Use the new sharded rate limiter for much better performance
var shardedRateLimiter = common.GetShardedRateLimiter()

// redisRateLimiterOptimized uses Lua scripts for atomic rate limiting
// This reduces 5-6 Redis RTTs to just 1 RTT
func redisRateLimiterOptimized(c *gin.Context, maxRequestNum int, duration int64, mark string) {
	ctx := c.Request.Context()
	key := mark + c.ClientIP()
	window := time.Duration(duration) * time.Second

	result, err := common.SlidingWindowRateLimit(ctx, key, maxRequestNum, window)
	if err != nil {
		logger.Error(ctx, "Redis rate limit error: "+err.Error())
		// Fail open on error
		c.Next()
		return
	}

	// Set rate limit headers
	c.Header("X-RateLimit-Limit", strconv.Itoa(maxRequestNum))
	c.Header("X-RateLimit-Remaining", strconv.Itoa(result.Remaining))
	c.Header("X-RateLimit-Reset", strconv.FormatInt(result.ResetAt.Unix(), 10))

	if !result.Allowed {
		c.Header("Retry-After", strconv.FormatInt(int64(time.Until(result.ResetAt).Seconds())+1, 10))
		c.Status(http.StatusTooManyRequests)
		c.Abort()
		return
	}
}

// memoryRateLimiterOptimized uses sharded rate limiter for 50x throughput
func memoryRateLimiterOptimized(c *gin.Context, maxRequestNum int, duration int64, mark string) {
	key := mark + c.ClientIP()

	allowed, remaining, resetAt := shardedRateLimiter.RequestWithInfo(key, maxRequestNum, duration)

	// Set rate limit headers
	c.Header("X-RateLimit-Limit", strconv.Itoa(maxRequestNum))
	c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
	c.Header("X-RateLimit-Reset", strconv.FormatInt(resetAt, 10))

	if !allowed {
		resetTime := time.Unix(resetAt, 0)
		c.Header("Retry-After", strconv.FormatInt(int64(time.Until(resetTime).Seconds())+1, 10))
		c.Status(http.StatusTooManyRequests)
		c.Abort()
		return
	}
}

// rateLimitFactoryOptimized creates optimized rate limiting middleware
func rateLimitFactoryOptimized(maxRequestNum int, duration int64, mark string) func(c *gin.Context) {
	if maxRequestNum == 0 || config.DebugEnabled {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	if common.RedisEnabled {
		return func(c *gin.Context) {
			redisRateLimiterOptimized(c, maxRequestNum, duration, mark)
		}
	} else {
		// Initialize sharded rate limiter
		shardedRateLimiter.Init(config.RateLimitKeyExpirationDuration)
		return func(c *gin.Context) {
			memoryRateLimiterOptimized(c, maxRequestNum, duration, mark)
		}
	}
}

// Legacy rate limiters (kept for backward compatibility)
var inMemoryRateLimiter common.InMemoryRateLimiter

func redisRateLimiter(c *gin.Context, maxRequestNum int, duration int64, mark string) {
	// Use optimized version
	redisRateLimiterOptimized(c, maxRequestNum, duration, mark)
}

func memoryRateLimiter(c *gin.Context, maxRequestNum int, duration int64, mark string) {
	// Use optimized version
	memoryRateLimiterOptimized(c, maxRequestNum, duration, mark)
}

func rateLimitFactory(maxRequestNum int, duration int64, mark string) func(c *gin.Context) {
	return rateLimitFactoryOptimized(maxRequestNum, duration, mark)
}

// GlobalWebRateLimit returns middleware for web rate limiting
func GlobalWebRateLimit() func(c *gin.Context) {
	return rateLimitFactoryOptimized(config.GlobalWebRateLimitNum, config.GlobalWebRateLimitDuration, "GW")
}

// GlobalAPIRateLimit returns middleware for API rate limiting
func GlobalAPIRateLimit() func(c *gin.Context) {
	return rateLimitFactoryOptimized(config.GlobalApiRateLimitNum, config.GlobalApiRateLimitDuration, "GA")
}

// CriticalRateLimit returns middleware for critical operations rate limiting
func CriticalRateLimit() func(c *gin.Context) {
	return rateLimitFactoryOptimized(config.CriticalRateLimitNum, config.CriticalRateLimitDuration, "CT")
}

// DownloadRateLimit returns middleware for download rate limiting
func DownloadRateLimit() func(c *gin.Context) {
	return rateLimitFactoryOptimized(config.DownloadRateLimitNum, config.DownloadRateLimitDuration, "DW")
}

// UploadRateLimit returns middleware for upload rate limiting
func UploadRateLimit() func(c *gin.Context) {
	return rateLimitFactoryOptimized(config.UploadRateLimitNum, config.UploadRateLimitDuration, "UP")
}

// TokenRateLimit provides per-token rate limiting
func TokenRateLimit(tokenKey string, maxRequestNum int, duration int64) bool {
	if maxRequestNum == 0 || config.DebugEnabled {
		return true
	}

	if common.RedisEnabled {
		ctx := context.Background()
		window := time.Duration(duration) * time.Second
		result, err := common.SlidingWindowRateLimit(ctx, "token:"+tokenKey, maxRequestNum, window)
		if err != nil {
			return true // Fail open
		}
		return result.Allowed
	}

	shardedRateLimiter.Init(config.RateLimitKeyExpirationDuration)
	return shardedRateLimiter.Request("token:"+tokenKey, maxRequestNum, duration)
}
