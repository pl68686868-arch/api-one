package cache

import (
	"bufio"
	"bytes"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/common/logger"
	relaymodel "github.com/songquanpeng/one-api/relay/model"
)

// StreamingCache handles caching of streaming SSE responses
type StreamingCache struct {
	chunks []string
	done   bool
}

// CaptureAndCacheStream captures streaming response while sending to client
// Returns accumulated response text for caching
func CaptureAndCacheStream(
	c *gin.Context,
	resp *http.Response,
	model string,
	messages []relaymodel.Message,
) (string, int, error) {
	// IMPORTANT: Close response body when done to prevent memory leaks
	defer resp.Body.Close()

	// Set SSE headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Status(resp.StatusCode)

	var buffer bytes.Buffer
	var totalTokens int
	
	// Use scanner with larger buffer for long responses (10MB max)
	const maxScanSize = 10 * 1024 * 1024
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), maxScanSize)
	
	for scanner.Scan() {
		line := scanner.Text()
		
		// Send to client immediately (no latency added)
		c.Writer.WriteString(line + "\n")
		c.Writer.Flush()
		
		// Buffer for caching
		buffer.WriteString(line + "\n")
		
		// Parse tokens from OpenAI streaming format
		if strings.HasPrefix(line, "data: ") {
			dataStr := strings.TrimPrefix(line, "data: ")
			if dataStr == "[DONE]" {
				continue
			}
			
			// Try to parse chunk for token counting
			var chunk map[string]interface{}
			if err := json.Unmarshal([]byte(dataStr), &chunk); err == nil {
				if usage, ok := chunk["usage"].(map[string]interface{}); ok {
					if total, ok := usage["total_tokens"].(float64); ok {
						totalTokens = int(total)
					}
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return "", 0, err
	}

	// Store complete stream in cache
	fullStream := buffer.String()
	
	// Estimate tokens if not provided (approximate)
	if totalTokens == 0 {
		totalTokens = len(strings.Split(fullStream, " ")) / 2
	}
	
	// Cache asynchronously to avoid blocking
	go func() {
		cache := GetCache()
		if err := cache.StoreCache(model, messages, fullStream, totalTokens); err != nil {
			logger.SysError("Failed to cache streaming response: " + err.Error())
		}
	}()

	return fullStream, totalTokens, nil
}

// ReplayCachedStream replays a cached SSE stream to client
func ReplayCachedStream(c *gin.Context, cachedStream string) error {
	// Set SSE headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Cache-Hit", "true") // Debug header
	c.Status(http.StatusOK)

	// Stream cached response line by line
	scanner := bufio.NewScanner(strings.NewReader(cachedStream))
	for scanner.Scan() {
		line := scanner.Text()
		c.Writer.WriteString(line + "\n")
		c.Writer.Flush()
	}

	return scanner.Err()
}

// ExtractContentFromStream extracts text content from cached stream for non-streaming fallback
func ExtractContentFromStream(cachedStream string) string {
	var fullContent strings.Builder
	scanner := bufio.NewScanner(strings.NewReader(cachedStream))
	
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "data: ") {
			dataStr := strings.TrimPrefix(line, "data: ")
			if dataStr == "[DONE]" {
				continue
			}
			
			var chunk map[string]interface{}
			if err := json.Unmarshal([]byte(dataStr), &chunk); err == nil {
				if choices, ok := chunk["choices"].([]interface{}); ok && len(choices) > 0 {
					if choice, ok := choices[0].(map[string]interface{}); ok {
						if delta, ok := choice["delta"].(map[string]interface{}); ok {
							if content, ok := delta["content"].(string); ok {
								fullContent.WriteString(content)
							}
						}
					}
				}
			}
		}
	}
	
	return fullContent.String()
}

// WrapResponseWriter wraps gin's ResponseWriter to capture streaming data
type CachingResponseWriter struct {
	gin.ResponseWriter
	buffer *bytes.Buffer
}

func NewCachingResponseWriter(w gin.ResponseWriter) *CachingResponseWriter {
	return &CachingResponseWriter{
		ResponseWriter: w,
		buffer:         &bytes.Buffer{},
	}
}

func (w *CachingResponseWriter) Write(data []byte) (int, error) {
	// Write to buffer for caching
	w.buffer.Write(data)
	// Write to client
	return w.ResponseWriter.Write(data)
}

func (w *CachingResponseWriter) GetCachedData() string {
	return w.buffer.String()
}
