package automodel

import (
	"context"
	"errors"
	"sort"
	"strings"
	"sync"

	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/logger"
	"github.com/songquanpeng/one-api/model"
	relaymodel "github.com/songquanpeng/one-api/relay/model"
)

// Virtual model names
const (
	ModelAuto      = "auto"
	ModelAutoFast  = "auto-fast"
	ModelAutoCheap = "auto-cheap"
	ModelAutoVi    = "auto-vi"
	ModelAutoCode  = "auto-code"
	ModelAutoSmart = "auto-smart"
)

// Strategy defines weights for channel selection
type Strategy struct {
	Quality float64 // Weight for model quality (0-1)
	Speed   float64 // Weight for response speed (0-1)
	Cost    float64 // Weight for cost efficiency (0-1)
}

// Virtual model strategies
var strategies = map[string]Strategy{
	ModelAuto:      {Quality: 0.4, Speed: 0.3, Cost: 0.3}, // Balanced
	ModelAutoFast:  {Quality: 0.2, Speed: 0.6, Cost: 0.2}, // Speed priority
	ModelAutoCheap: {Quality: 0.2, Speed: 0.2, Cost: 0.6}, // Cost priority
	ModelAutoVi:    {Quality: 0.5, Speed: 0.2, Cost: 0.3}, // Vietnamese quality
	ModelAutoCode:  {Quality: 0.6, Speed: 0.2, Cost: 0.2}, // Code quality
	ModelAutoSmart: {Quality: 0.7, Speed: 0.15, Cost: 0.15}, // Highest quality
}

// Model tiers (1=best, 3=budget)
var modelTiers = map[string]int{
	// Tier 1: Flagship models
	"gpt-4o":                 1,
	"gpt-4o-2024-11-20":      1,
	"claude-3-5-sonnet":      1,
	"claude-3.5-sonnet":      1,
	"gemini-1.5-pro":         1,
	"gpt-4-turbo":            1,
	"claude-3-opus":          1,
	
	// Tier 2: Fast/mid-tier models
	"gpt-4o-mini":            2,
	"gpt-4o-mini-2024-07-18": 2,
	"claude-3-haiku":         2,
	"gemini-1.5-flash":       2,
	"deepseek-v3":            2,
	"deepseek-chat":          2,
	"qwen-max":               2,
	
	// Tier 3: Budget models
	"qwen-turbo":             3,
	"qwen-plus":              3,
	"deepseek-coder":         3,
	"llama-3.1-70b":          3,
	"llama-3.1-8b":           3,
}

// Vietnamese quality scores (0-1)
var vietnameseScores = map[string]float64{
	"gpt-4o":                 0.95,
	"gpt-4o-2024-11-20":      0.95,
	"claude-3-5-sonnet":      0.95,
	"claude-3.5-sonnet":      0.95,
	"gpt-4o-mini":            0.91,
	"gpt-4o-mini-2024-07-18": 0.91,
	"deepseek-v3":            0.90,
	"deepseek-chat":          0.88,
	"gemini-1.5-pro":         0.87,
	"gemini-1.5-flash":       0.85,
	"claude-3-haiku":         0.82,
	"qwen-max":               0.78,
	"qwen-turbo":             0.70,
}

// Code quality scores (0-1)
var codeScores = map[string]float64{
	"claude-3-5-sonnet":      0.95,
	"claude-3.5-sonnet":      0.95,
	"gpt-4o":                 0.93,
	"gpt-4o-2024-11-20":      0.93,
	"deepseek-coder":         0.92,
	"deepseek-v3":            0.90,
	"gemini-1.5-pro":         0.88,
	"gpt-4o-mini":            0.85,
	"claude-3-haiku":         0.80,
}

// Cost per 1M tokens (approximate, normalized to GPT-4 = 1.0)
var costRatios = map[string]float64{
	"gpt-4o":                 1.0,
	"gpt-4o-2024-11-20":      1.0,
	"claude-3-5-sonnet":      0.6,
	"claude-3.5-sonnet":      0.6,
	"claude-3-opus":          3.0,
	"gpt-4-turbo":            2.0,
	"gemini-1.5-pro":         0.7,
	"gpt-4o-mini":            0.1,
	"gpt-4o-mini-2024-07-18": 0.1,
	"claude-3-haiku":         0.05,
	"gemini-1.5-flash":       0.05,
	"deepseek-v3":            0.03,
	"deepseek-chat":          0.02,
	"deepseek-coder":         0.02,
	"qwen-max":               0.1,
	"qwen-turbo":             0.02,
	"qwen-plus":              0.05,
	"llama-3.1-70b":          0.02,
	"llama-3.1-8b":           0.01,
}

// SelectionResult contains the result of model selection
type SelectionResult struct {
	RequestedModel string  // Original virtual model
	SelectedModel  string  // Actual model selected
	ChannelID      int     // Selected channel ID
	Score          float64 // Selection score
	Reason         string  // Why this was selected
}

var (
	resolverEnabled = false
	resolverMu      sync.RWMutex
)

// Init initializes the automodel resolver
func Init() {
	resolverMu.Lock()
	defer resolverMu.Unlock()
	
	resolverEnabled = config.AutoModelEnabled
	if resolverEnabled {
		logger.SysLog("automodel: Virtual model resolver enabled")
	}
}

// IsVirtualModel checks if the model name is a virtual model
func IsVirtualModel(modelName string) bool {
	_, exists := strategies[strings.ToLower(modelName)]
	return exists
}

// IsEnabled returns whether virtual model resolution is enabled
func IsEnabled() bool {
	resolverMu.RLock()
	defer resolverMu.RUnlock()
	return resolverEnabled
}

// Resolve resolves a virtual model to an actual model and channel
func Resolve(ctx context.Context, virtualModel string, group string, messages []relaymodel.Message) (*SelectionResult, error) {
	// Get strategy for this virtual model
	strategy, exists := strategies[strings.ToLower(virtualModel)]
	if !exists {
		return nil, errors.New("unknown virtual model: " + virtualModel)
	}

	// Analyze request features
	features := AnalyzeRequest(messages)

	// Adjust strategy based on detected language
	if features.Language == "vi" {
		// For Vietnamese content, boost quality weight
		strategy = strategies[ModelAutoVi]
	}

	// Get all available channels for this group
	channels := getAvailableChannels(group)
	if len(channels) == 0 {
		return nil, errors.New("no available channels for group: " + group)
	}

	// Score each channel and its models
	type scoredOption struct {
		channel *model.Channel
		model   string
		score   float64
	}

	var options []scoredOption

	for _, channel := range channels {
		for _, modelName := range getChannelModels(channel) {
			score := calculateScore(channel, modelName, strategy, features)
			options = append(options, scoredOption{
				channel: channel,
				model:   modelName,
				score:   score,
			})
		}
	}

	if len(options) == 0 {
		return nil, errors.New("no models available")
	}

	// Sort by score descending
	sort.Slice(options, func(i, j int) bool {
		return options[i].score > options[j].score
	})

	// Select the best option
	best := options[0]

	logger.Debugf(ctx, "automodel: %s -> %s (channel %d, score %.2f)", 
		virtualModel, best.model, best.channel.Id, best.score)

	return &SelectionResult{
		RequestedModel: virtualModel,
		SelectedModel:  best.model,
		ChannelID:      best.channel.Id,
		Score:          best.score,
		Reason:         getSelectionReason(virtualModel, features),
	}, nil
}

// calculateScore calculates the overall score for a model on a channel
func calculateScore(channel *model.Channel, modelName string, strategy Strategy, features *RequestFeatures) float64 {
	// Get health score from existing tracker
	healthScore := getHealthScore(channel.Id)

	// Get quality score based on tier
	qualityScore := getQualityScore(modelName, features)

	// Get cost score (inverse of cost ratio)
	costScore := getCostScore(modelName)

	// Calculate weighted score
	score := (qualityScore * strategy.Quality) +
		(healthScore * strategy.Speed) +
		(costScore * strategy.Cost)

	// Apply channel weight if set
	if channel.Weight != nil && *channel.Weight > 0 {
		score *= float64(*channel.Weight)
	}

	// Apply priority bonus
	priority := channel.GetPriority()
	if priority > 0 {
		score *= (1.0 + float64(priority)*0.1)
	}

	return score
}

// getHealthScore gets health/speed score from channel health tracker
func getHealthScore(channelID int) float64 {
	tracker := model.GetHealthTracker()
	health := tracker.GetHealth(channelID)
	if health == nil {
		return 0.8 // Default for unknown channels
	}

	// Combine success rate and latency
	successRate := health.SuccessRate()
	avgLatency := health.AvgLatency()

	// Convert latency to score (lower is better)
	// 100ms = 1.0, 500ms = 0.5, 1000ms = 0.25
	latencyScore := 100.0 / float64(avgLatency.Milliseconds()+100)

	return (successRate*0.6 + latencyScore*0.4)
}

// getQualityScore gets quality score for a model
func getQualityScore(modelName string, features *RequestFeatures) float64 {
	// Check for special scores based on request features
	if features.Language == "vi" {
		if score, ok := vietnameseScores[modelName]; ok {
			return score
		}
	}

	if features.HasCode {
		if score, ok := codeScores[modelName]; ok {
			return score
		}
	}

	// Use tier-based scoring
	tier, exists := modelTiers[modelName]
	if !exists {
		// Try partial match
		for name, t := range modelTiers {
			if strings.Contains(strings.ToLower(modelName), strings.ToLower(name)) {
				tier = t
				exists = true
				break
			}
		}
	}

	if !exists {
		return 0.6 // Default for unknown models
	}

	switch tier {
	case 1:
		return 0.95
	case 2:
		return 0.75
	case 3:
		return 0.55
	default:
		return 0.6
	}
}

// getCostScore gets cost efficiency score (higher = cheaper)
func getCostScore(modelName string) float64 {
	ratio, exists := costRatios[modelName]
	if !exists {
		// Try partial match
		for name, r := range costRatios {
			if strings.Contains(strings.ToLower(modelName), strings.ToLower(name)) {
				ratio = r
				exists = true
				break
			}
		}
	}

	if !exists {
		return 0.5 // Default for unknown models
	}

	// Inverse: lower cost = higher score
	// Cost 0.01 -> score 0.99, Cost 1.0 -> score 0.5, Cost 3.0 -> score 0.25
	return 1.0 / (1.0 + ratio)
}

// getAvailableChannels gets all enabled channels for a group
func getAvailableChannels(group string) []*model.Channel {
	// Use existing GetAllChannels
	channels, _ := model.GetAllChannels(0, 0, "enabled")
	
	var result []*model.Channel
	for _, ch := range channels {
		// Check if channel serves this group
		if containsGroup(ch.Group, group) {
			result = append(result, ch)
		}
	}
	return result
}

// containsGroup checks if group string contains the target group
func containsGroup(groupStr string, target string) bool {
	groups := strings.Split(groupStr, ",")
	for _, g := range groups {
		if strings.TrimSpace(g) == target {
			return true
		}
	}
	return false
}

// getChannelModels gets all models for a channel
func getChannelModels(channel *model.Channel) []string {
	if channel.Models == "" {
		return nil
	}
	
	parts := strings.Split(channel.Models, ",")
	var models []string
	for _, p := range parts {
		m := strings.TrimSpace(p)
		if m != "" {
			models = append(models, m)
		}
	}
	return models
}

// getSelectionReason returns a human-readable reason for selection
func getSelectionReason(virtualModel string, features *RequestFeatures) string {
	switch virtualModel {
	case ModelAutoFast:
		return "Selected for lowest latency"
	case ModelAutoCheap:
		return "Selected for cost efficiency"
	case ModelAutoVi:
		return "Selected for Vietnamese language support"
	case ModelAutoCode:
		return "Selected for code generation quality"
	case ModelAutoSmart:
		return "Selected for highest quality"
	default:
		if features.Language == "vi" {
			return "Balanced selection with Vietnamese optimization"
		}
		return "Balanced selection"
	}
}
