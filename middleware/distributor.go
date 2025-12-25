package middleware

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/songquanpeng/one-api/common/ctxkey"
	"github.com/songquanpeng/one-api/common/logger"
	"github.com/songquanpeng/one-api/model"
	"github.com/songquanpeng/one-api/relay/automodel"
	"github.com/songquanpeng/one-api/relay/channeltype"
	relaymodel "github.com/songquanpeng/one-api/relay/model"
)

type ModelRequest struct {
	Model string `json:"model" form:"model"`
}

func Distribute() func(c *gin.Context) {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		userId := c.GetInt(ctxkey.Id)
		userGroup, _ := model.CacheGetUserGroup(userId)
		c.Set(ctxkey.Group, userGroup)
		var requestModel string
		var channel *model.Channel
		channelId, ok := c.Get(ctxkey.SpecificChannelId)
		if ok {
			id, err := strconv.Atoi(channelId.(string))
			if err != nil {
				abortWithMessage(c, http.StatusBadRequest, "无效的渠道 Id")
				return
			}
			channel, err = model.GetChannelById(id, true)
			if err != nil {
				abortWithMessage(c, http.StatusBadRequest, "无效的渠道 Id")
				return
			}
			if channel.Status != model.ChannelStatusEnabled {
				abortWithMessage(c, http.StatusForbidden, "该渠道已被禁用")
				return
			}

			// Set selection metrics for specific channel requests
			c.Set(ctxkey.SelectionReason, "Direct channel selection")
			c.Set(ctxkey.SelectionScore, 1.0) // Direct selection = perfect score
			c.Set(ctxkey.AvailableChannels, 1) // Only one channel specified

			// Get health score if available
			if healthTracker := model.GetHealthTracker(); healthTracker != nil {
				if health := healthTracker.GetHealth(id); health != nil {
					// Calculate health score: success_rate * 100
					var healthScore float64
					if health.TotalRequests > 0 {
						healthScore = (float64(health.SuccessCount) / float64(health.TotalRequests)) * 100
					}
					c.Set(ctxkey.ChannelHealthScore, healthScore)
				}
			}
		} else {
			requestModel = c.GetString(ctxkey.RequestModel)
			userGroup := c.GetString(ctxkey.Group)

			// ALWAYS use intelligent channel selection for load balancing
			// Check if this is a virtual model that needs model resolution too
			if automodel.IsEnabled() && automodel.IsVirtualModel(requestModel) {
				// Get messages for analysis (need to parse request body)
				messages := getMessagesFromContext(c)
				
				result, err := automodel.Resolve(ctx, requestModel, userGroup, messages)
				if err != nil {
					logger.Warnf(ctx, "automodel: failed to resolve %s: %v, falling back to default", requestModel, err)
					// Fall through to regular channel selection with a default model
					requestModel = "gpt-4o-mini" // Safe fallback
				} else {
					// Success! Use the resolved model and channel
					logger.Infof(ctx, "automodel: %s -> %s (channel %d, score %.2f, reason: %s)", 
						result.RequestedModel, result.SelectedModel, result.ChannelID, result.Score, result.Reason)
					
					// Set response headers for transparency
					c.Header("X-Auto-Requested-Model", result.RequestedModel)
					c.Header("X-Auto-Selected-Model", result.SelectedModel)
					c.Header("X-Auto-Selection-Score", fmt.Sprintf("%.2f", result.Score))
					c.Header("X-Auto-Selection-Reason", result.Reason)
					
					// Get the channel and set up context
					channel, err = model.GetChannelById(result.ChannelID, true)
					if err == nil && channel != nil {
						requestModel = result.SelectedModel
						c.Set(ctxkey.RequestModel, requestModel)
						
						// Store selection metrics for logging
						c.Set(ctxkey.SelectionReason, result.Reason)
						c.Set(ctxkey.SelectionScore, result.Score)
						// Note: AvailableChannels not tracked in automodel (SelectionResult has no AvailableCount field)
						
						SetupContextForSelectedChannel(c, channel, requestModel)
						c.Next()
						return
					}
					// If channel fetch fails, fall through to regular selection
					requestModel = result.SelectedModel
				}
			}
			
		// For non-virtual models, use intelligent channel selection based on health
		var err error
		selectionInfo, err := model.CacheGetHealthiestChannel(userGroup, requestModel)
		
		// Tracking variables
		var healthScore float64
		var selectionReason string
		var availableChannels int
		var selectionScore float64
		
		if err != nil {
			// Fallback to random if healthiest fails
			channel, err = model.CacheGetRandomSatisfiedChannel(userGroup, requestModel, false)
			if err != nil {
				message := fmt.Sprintf("当前分组 %s 下对于模型 %s 无可用渠道", userGroup, requestModel)
				if channel != nil {
					logger.SysError(fmt.Sprintf("渠道不存在：%d", channel.Id))
					message = "数据库一致性已被破坏，请联系管理员"
				}
				abortWithMessage(c, http.StatusServiceUnavailable, message)
				return
			}
			selectionReason = "Random selection (health tracker unavailable)"
			availableChannels = 1 // Unknown, assume at least 1
		} else {
			// Success! Use health-based selection with full tracking
			channel = selectionInfo.Channel
			availableChannels = selectionInfo.AvailableCount
			selectionScore = selectionInfo.SelectionScore
			
			// Get health metrics for detailed reason
			tracker := model.GetHealthTracker()
			health := tracker.GetHealth(channel.Id)
			if health != nil {
				healthScore = health.SuccessRate()
				selectionReason = fmt.Sprintf("Health-based selection (success rate: %.1f%%, avg latency: %dms, score: %.0f, %d channels available)", 
					healthScore*100, health.AvgLatency().Milliseconds(), selectionScore, availableChannels)
			} else {
				selectionReason = fmt.Sprintf("Health-based selection (%d channels available)", availableChannels)
			}
		}
		
		// Store all metrics in context for logging
		c.Set(ctxkey.SelectionReason, selectionReason)
		c.Set(ctxkey.AvailableChannels, availableChannels)
		if healthScore > 0 {
			c.Set(ctxkey.ChannelHealthScore, healthScore)
		}
		if selectionScore > 0 {
			c.Set(ctxkey.SelectionScore, selectionScore)
		}
	}

		logger.Debugf(ctx, "user id %d, user group: %s, request model: %s, using channel #%d", userId, userGroup, requestModel, channel.Id)
		SetupContextForSelectedChannel(c, channel, requestModel)
		c.Next()
	}
}

func SetupContextForSelectedChannel(c *gin.Context, channel *model.Channel, modelName string) {
	c.Set(ctxkey.Channel, channel.Type)
	c.Set(ctxkey.ChannelId, channel.Id)
	c.Set(ctxkey.ChannelName, channel.Name)
	if channel.SystemPrompt != nil && *channel.SystemPrompt != "" {
		c.Set(ctxkey.SystemPrompt, *channel.SystemPrompt)
	}
	
	// Get model mapping and track actual model
	modelMapping := channel.GetModelMapping()
	c.Set(ctxkey.ModelMapping, modelMapping)
	
	// Determine actual model after mapping
	actualModel := modelName
	if modelMapping != nil {
		if mapped, exists := modelMapping[modelName]; exists {
			actualModel = mapped
		}
	}
	c.Set(ctxkey.ActualModel, actualModel) // Store actual model after mapping
	
	c.Set(ctxkey.OriginalModel, modelName) // for retry
	c.Request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", channel.Key))
	c.Set(ctxkey.BaseURL, channel.GetBaseURL())
	
	// Note: ChannelHealthScore is now set in distributor to avoid duplicate query
	
	cfg, _ := channel.LoadConfig()
	// this is for backward compatibility
	if channel.Other != nil {
		switch channel.Type {
		case channeltype.Azure:
			if cfg.APIVersion == "" {
				cfg.APIVersion = *channel.Other
			}
		case channeltype.Xunfei:
			if cfg.APIVersion == "" {
				cfg.APIVersion = *channel.Other
			}
		case channeltype.Gemini:
			if cfg.APIVersion == "" {
				cfg.APIVersion = *channel.Other
			}
		case channeltype.AIProxyLibrary:
			if cfg.LibraryID == "" {
				cfg.LibraryID = *channel.Other
			}
		case channeltype.Ali:
			if cfg.Plugin == "" {
				cfg.Plugin = *channel.Other
			}
		}
	}
	c.Set(ctxkey.Config, cfg)
}

// getMessagesFromContext extracts messages from the request context for automodel analysis
func getMessagesFromContext(c *gin.Context) []relaymodel.Message {
	// Try to get parsed messages from context (set by earlier middleware)
	if messages, ok := c.Get("parsed_messages"); ok {
		if msgs, ok := messages.([]relaymodel.Message); ok {
			return msgs
		}
	}
	
	// If not available, return empty - the analyzer will handle it
	return nil
}
