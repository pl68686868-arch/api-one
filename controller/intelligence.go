package controller

import (
	"net/http"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/model"
)

// ProviderHealth represents the health status of a provider
type ProviderHealth struct {
	Provider     string  `json:"provider"`
	ChannelCount int     `json:"channel_count"`
	Status       string  `json:"status"` // healthy, degraded, down
	SuccessRate  float64 `json:"success_rate"`
	AvgLatencyMs int64   `json:"avg_latency_ms"`
	RequestCount int64   `json:"request_count"`
	ErrorCount   int64   `json:"error_count"`
}

// ChannelHealthDetail represents detailed health info for a channel
type ChannelHealthDetail struct {
	ChannelID       int     `json:"channel_id"`
	ChannelName     string  `json:"channel_name"`
	Provider        string  `json:"provider"`
	Status          string  `json:"status"`
	SuccessRate     float64 `json:"success_rate"`
	AvgLatencyMs    int64   `json:"avg_latency_ms"`
	RequestCount    int64   `json:"request_count"`
	ConsecutiveFail int     `json:"consecutive_fail"`
	Score           float64 `json:"score"`
}

// IntelligenceStats represents overall intelligence system stats
type IntelligenceStats struct {
	TotalRequests     int64   `json:"total_requests"`
	AutoSelectCount   int64   `json:"auto_select_count"`
	AvgLatencyMs      int64   `json:"avg_latency_ms"`
	OverallSuccessRate float64 `json:"overall_success_rate"`
	ActiveChannels    int     `json:"active_channels"`
	HealthyChannels   int     `json:"healthy_channels"`
	DegradedChannels  int     `json:"degraded_channels"`
	DownChannels      int     `json:"down_channels"`
}

// GetIntelligenceHealth returns health status grouped by provider
func GetIntelligenceHealth(c *gin.Context) {
	stats := model.GetChannelHealthStats()
	channels, _ := model.GetAllChannels(0, 0, "enabled")

	// Create channel ID to channel map
	channelMap := make(map[int]*model.Channel)
	for _, ch := range channels {
		channelMap[ch.Id] = ch
	}

	// Group by provider
	providerStats := make(map[string]*ProviderHealth)

	for channelID, stat := range stats {
		channel, exists := channelMap[channelID]
		if !exists {
			continue
		}

		provider := getProviderName(channel.Type)
		if _, ok := providerStats[provider]; !ok {
			providerStats[provider] = &ProviderHealth{
				Provider: provider,
			}
		}

		ps := providerStats[provider]
		ps.ChannelCount++
		ps.RequestCount += safeInt64(stat, "total_requests")
		ps.ErrorCount += safeInt64(stat, "failure_count")
		ps.AvgLatencyMs += safeInt64(stat, "avg_latency_ms")
	}

	// Calculate averages and status
	var result []ProviderHealth
	for _, ps := range providerStats {
		if ps.ChannelCount > 0 {
			ps.AvgLatencyMs /= int64(ps.ChannelCount)
		}
		if ps.RequestCount > 0 {
			ps.SuccessRate = float64(ps.RequestCount-ps.ErrorCount) / float64(ps.RequestCount)
		} else {
			ps.SuccessRate = 1.0
		}

		// Determine status
		if ps.SuccessRate >= 0.95 {
			ps.Status = "healthy"
		} else if ps.SuccessRate >= 0.80 {
			ps.Status = "degraded"
		} else {
			ps.Status = "down"
		}

		result = append(result, *ps)
	}

	// Sort by provider name
	sort.Slice(result, func(i, j int) bool {
		return result[i].Provider < result[j].Provider
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

// Safe type assertion helpers
func safeInt64(m map[string]interface{}, key string) int64 {
	if v, ok := m[key]; ok {
		if i, ok := v.(int64); ok {
			return i
		}
	}
	return 0
}

func safeFloat64(m map[string]interface{}, key string) float64 {
	if v, ok := m[key]; ok {
		if f, ok := v.(float64); ok {
			return f
		}
	}
	return 0.0
}

func safeInt(m map[string]interface{}, key string) int {
	if v, ok := m[key]; ok {
		if i, ok := v.(int); ok {
			return i
		}
	}
	return 0
}

// GetChannelHealthDetails returns detailed health for all channels
func GetChannelHealthDetails(c *gin.Context) {
	stats := model.GetChannelHealthStats()
	channels, _ := model.GetAllChannels(0, 0, "enabled")

	var result []ChannelHealthDetail
	for _, channel := range channels {
		detail := ChannelHealthDetail{
			ChannelID:   channel.Id,
			ChannelName: channel.Name,
			Provider:    getProviderName(channel.Type),
			Status:      "unknown",
			SuccessRate: 1.0,
			Score:       1000,
		}

		if stat, ok := stats[channel.Id]; ok {
			detail.SuccessRate = safeFloat64(stat, "success_rate")
			detail.AvgLatencyMs = safeInt64(stat, "avg_latency_ms")
			detail.RequestCount = safeInt64(stat, "total_requests")
			detail.ConsecutiveFail = safeInt(stat, "consecutive_fail")
			detail.Score = safeFloat64(stat, "score")

			// Determine status
			if detail.SuccessRate >= 0.95 && detail.ConsecutiveFail == 0 {
				detail.Status = "healthy"
			} else if detail.SuccessRate >= 0.80 || detail.ConsecutiveFail < 3 {
				detail.Status = "degraded"
			} else {
				detail.Status = "down"
			}
		}

		result = append(result, detail)
	}

	// Sort by score descending
	sort.Slice(result, func(i, j int) bool {
		return result[i].Score > result[j].Score
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

// GetIntelligenceStats returns overall stats for the intelligence system
func GetIntelligenceStats(c *gin.Context) {
	stats := model.GetChannelHealthStats()
	channels, _ := model.GetAllChannels(0, 0, "enabled")

	result := IntelligenceStats{
		ActiveChannels: len(channels),
	}

	var totalLatency int64
	var channelsWithData int

	for _, stat := range stats {
		result.TotalRequests += safeInt64(stat, "total_requests")
		totalLatency += safeInt64(stat, "avg_latency_ms")
		channelsWithData++

		successRate := safeFloat64(stat, "success_rate")
		consecutiveFail := safeInt(stat, "consecutive_fail")

		if successRate >= 0.95 && consecutiveFail == 0 {
			result.HealthyChannels++
		} else if successRate >= 0.80 || consecutiveFail < 3 {
			result.DegradedChannels++
		} else {
			result.DownChannels++
		}
	}


	if channelsWithData > 0 {
		result.AvgLatencyMs = totalLatency / int64(channelsWithData)
	}

	if result.TotalRequests > 0 {
		// Calculate overall success rate
		var totalSuccess int64
		for _, stat := range stats {
			totalSuccess += safeInt64(stat, "success_count")
		}
		result.OverallSuccessRate = float64(totalSuccess) / float64(result.TotalRequests)
	} else {
		result.OverallSuccessRate = 1.0
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

// GetStrategies returns available selection strategies
func GetStrategies(c *gin.Context) {
	strategies := []map[string]interface{}{
		{
			"name":          "balanced",
			"display_name":  "Balanced",
			"description":   "Equal weight to health, speed, and cost",
			"health_weight": 0.4,
			"speed_weight":  0.3,
			"cost_weight":   0.3,
		},
		{
			"name":          "performance",
			"display_name":  "Performance",
			"description":   "Prioritize low latency",
			"health_weight": 0.3,
			"speed_weight":  0.5,
			"cost_weight":   0.2,
		},
		{
			"name":          "cost",
			"display_name":  "Cost Efficient",
			"description":   "Prioritize lower cost",
			"health_weight": 0.2,
			"speed_weight":  0.2,
			"cost_weight":   0.6,
		},
		{
			"name":          "resilient",
			"display_name":  "Resilient",
			"description":   "Prioritize reliability",
			"health_weight": 0.6,
			"speed_weight":  0.2,
			"cost_weight":   0.2,
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    strategies,
	})
}

// getProviderName converts channel type to provider name
func getProviderName(channelType int) string {
	// Map common channel types to provider names
	providers := map[int]string{
		1:  "OpenAI",
		3:  "Azure",
		14: "Anthropic",
		24: "Gemini",
		15: "Baidu",
		16: "Zhipu",
		17: "Ali",
		23: "Tencent",
		25: "Moonshot",
		28: "Mistral",
		29: "Groq",
		30: "Ollama",
		36: "DeepSeek",
		50: "OpenAI Compatible",
	}

	if name, ok := providers[channelType]; ok {
		return name
	}
	return "Other"
}

// Helper to safely get string from interface map
func getProviderNameFromModels(models string) string {
	if models == "" {
		return "Unknown"
	}
	
	// Extract provider from first model name
	parts := strings.Split(models, ",")
	if len(parts) == 0 {
		return "Unknown"
	}

	model := strings.TrimSpace(parts[0])
	if strings.HasPrefix(model, "gpt") {
		return "OpenAI"
	}
	if strings.HasPrefix(model, "claude") {
		return "Anthropic"
	}
	if strings.HasPrefix(model, "gemini") {
		return "Google"
	}
	if strings.HasPrefix(model, "deepseek") {
		return "DeepSeek"
	}

	return "Other"
}
