package model

import (
	"math/rand"
	"sync"
	"time"
)

// ChannelHealth tracks the health metrics of a channel
type ChannelHealth struct {
	ChannelId      int
	TotalRequests  int64
	SuccessCount   int64
	FailureCount   int64
	TotalLatency   time.Duration // Sum of all latencies
	LastLatency    time.Duration
	LastError      time.Time
	LastSuccess    time.Time
	ConsecutiveFail int
	mu             sync.RWMutex
}

// ChannelHealthTracker tracks health metrics for all channels
type ChannelHealthTracker struct {
	channels map[int]*ChannelHealth
	mu       sync.RWMutex
}

var (
	healthTracker     *ChannelHealthTracker
	healthTrackerOnce sync.Once
)

// GetHealthTracker returns the singleton health tracker
func GetHealthTracker() *ChannelHealthTracker {
	healthTrackerOnce.Do(func() {
		healthTracker = &ChannelHealthTracker{
			channels: make(map[int]*ChannelHealth),
		}
	})
	return healthTracker
}

// GetOrCreate gets or creates a channel health record
func (t *ChannelHealthTracker) GetOrCreate(channelId int) *ChannelHealth {
	t.mu.RLock()
	h, exists := t.channels[channelId]
	t.mu.RUnlock()

	if exists {
		return h
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	// Double-check
	if h, exists = t.channels[channelId]; exists {
		return h
	}

	h = &ChannelHealth{ChannelId: channelId}
	t.channels[channelId] = h
	return h
}

// RecordSuccess records a successful request
func (t *ChannelHealthTracker) RecordSuccess(channelId int, latency time.Duration) {
	h := t.GetOrCreate(channelId)
	h.mu.Lock()
	defer h.mu.Unlock()

	h.TotalRequests++
	h.SuccessCount++
	h.TotalLatency += latency
	h.LastLatency = latency
	h.LastSuccess = time.Now()
	h.ConsecutiveFail = 0
}

// RecordFailure records a failed request
func (t *ChannelHealthTracker) RecordFailure(channelId int, latency time.Duration) {
	h := t.GetOrCreate(channelId)
	h.mu.Lock()
	defer h.mu.Unlock()

	h.TotalRequests++
	h.FailureCount++
	h.TotalLatency += latency
	h.LastLatency = latency
	h.LastError = time.Now()
	h.ConsecutiveFail++
}

// GetHealth returns the health record for a channel
func (t *ChannelHealthTracker) GetHealth(channelId int) *ChannelHealth {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.channels[channelId]
}

// SuccessRate returns the success rate (0.0-1.0)
func (h *ChannelHealth) SuccessRate() float64 {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if h.TotalRequests == 0 {
		return 1.0 // No data, assume healthy
	}
	return float64(h.SuccessCount) / float64(h.TotalRequests)
}

// AvgLatency returns the average latency
func (h *ChannelHealth) AvgLatency() time.Duration {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if h.TotalRequests == 0 {
		return 100 * time.Millisecond // Default assumption
	}
	return time.Duration(int64(h.TotalLatency) / h.TotalRequests)
}

// Score calculates a health score for the channel
// Higher score = better channel
// Score = (success_rate * weight) / (latency_ms + 1)
func (h *ChannelHealth) Score(weight float64) float64 {
	if weight <= 0 {
		weight = 1.0
	}

	successRate := h.SuccessRate()
	avgLatencyMs := float64(h.AvgLatency().Milliseconds())

	// Avoid division by zero, add 1ms baseline
	if avgLatencyMs < 1 {
		avgLatencyMs = 1
	}

	// Penalize consecutive failures
	h.mu.RLock()
	consecutiveFail := h.ConsecutiveFail
	h.mu.RUnlock()

	failPenalty := 1.0
	if consecutiveFail > 0 {
		// Reduce score by 50% for each consecutive failure
		failPenalty = 1.0 / float64(1+consecutiveFail)
	}

	return (successRate * weight * failPenalty * 1000) / avgLatencyMs
}

// SelectionStrategy defines weights for different selection criteria
type SelectionStrategy struct {
	Name         string
	HealthWeight float64 // Weight for success rate (0-1)
	SpeedWeight  float64 // Weight for latency (0-1)
	CostWeight   float64 // Weight for cost efficiency (0-1)
}

// Predefined selection strategies
var (
	StrategyBalanced = SelectionStrategy{
		Name:         "balanced",
		HealthWeight: 0.4,
		SpeedWeight:  0.3,
		CostWeight:   0.3,
	}
	StrategyPerformance = SelectionStrategy{
		Name:         "performance",
		HealthWeight: 0.3,
		SpeedWeight:  0.5,
		CostWeight:   0.2,
	}
	StrategyCost = SelectionStrategy{
		Name:         "cost",
		HealthWeight: 0.2,
		SpeedWeight:  0.2,
		CostWeight:   0.6,
	}
	StrategyResilient = SelectionStrategy{
		Name:         "resilient",
		HealthWeight: 0.6,
		SpeedWeight:  0.2,
		CostWeight:   0.2,
	}
)

// StrategyMap for lookup by name
var StrategyMap = map[string]SelectionStrategy{
	"balanced":    StrategyBalanced,
	"performance": StrategyPerformance,
	"cost":        StrategyCost,
	"resilient":   StrategyResilient,
}

// GetStrategy returns a strategy by name, defaults to balanced
func GetStrategy(name string) SelectionStrategy {
	if strategy, ok := StrategyMap[name]; ok {
		return strategy
	}
	return StrategyBalanced
}

// ScoreWithStrategy calculates a weighted score based on strategy
// Higher score = better channel
func (h *ChannelHealth) ScoreWithStrategy(weight float64, strategy SelectionStrategy, costRatio float64) float64 {
	if weight <= 0 {
		weight = 1.0
	}
	if costRatio <= 0 {
		costRatio = 1.0
	}

	// Health score (success rate)
	healthScore := h.SuccessRate()

	// Speed score (inverse of latency, normalized)
	avgLatencyMs := float64(h.AvgLatency().Milliseconds())
	if avgLatencyMs < 1 {
		avgLatencyMs = 1
	}
	// Normalize: 100ms = 1.0, 500ms = 0.2, 1000ms = 0.1
	speedScore := 100.0 / avgLatencyMs
	if speedScore > 1.0 {
		speedScore = 1.0
	}

	// Cost score (inverse of cost ratio)
	// Lower cost = higher score
	costScore := 1.0 / (1.0 + costRatio)

	// Apply consecutive failure penalty
	h.mu.RLock()
	consecutiveFail := h.ConsecutiveFail
	h.mu.RUnlock()

	failPenalty := 1.0
	if consecutiveFail > 0 {
		failPenalty = 1.0 / float64(1+consecutiveFail)
	}

	// Calculate weighted score
	totalScore := (healthScore * strategy.HealthWeight) +
		(speedScore * strategy.SpeedWeight) +
		(costScore * strategy.CostWeight)

	return totalScore * weight * failPenalty * 1000
}

// SmartChannelSelector implements intelligent channel selection
type SmartChannelSelector struct {
	tracker *ChannelHealthTracker
}

// NewSmartChannelSelector creates a new smart channel selector
func NewSmartChannelSelector() *SmartChannelSelector {
	return &SmartChannelSelector{
		tracker: GetHealthTracker(),
	}
}

// SelectChannel selects the best channel using Power of Two Choices (P2C) algorithm
// P2C: Randomly pick 2 channels, choose the one with better score
// This provides near-optimal load balancing with O(1) complexity
func (s *SmartChannelSelector) SelectChannel(channels []*Channel) *Channel {
	n := len(channels)
	if n == 0 {
		return nil
	}
	if n == 1 {
		return channels[0]
	}
	if n == 2 {
		return s.betterChannel(channels[0], channels[1])
	}

	// P2C: Pick 2 random channels
	idx1 := rand.Intn(n)
	idx2 := rand.Intn(n - 1)
	if idx2 >= idx1 {
		idx2++ // Ensure different indices
	}

	return s.betterChannel(channels[idx1], channels[idx2])
}

// SelectChannelWithPriority selects channel respecting priority groups
// First filters to highest priority, then applies P2C within that group
func (s *SmartChannelSelector) SelectChannelWithPriority(channels []*Channel, ignoreFirstPriority bool) *Channel {
	if len(channels) == 0 {
		return nil
	}

	// Find priority groups
	firstPriority := channels[0].GetPriority()
	priorityGroupEnd := len(channels)

	if firstPriority > 0 {
		for i := range channels {
			if channels[i].GetPriority() != firstPriority {
				priorityGroupEnd = i
				break
			}
		}
	}

	// Select from appropriate group
	var candidateChannels []*Channel
	if ignoreFirstPriority && priorityGroupEnd < len(channels) {
		// Use lower priority channels
		candidateChannels = channels[priorityGroupEnd:]
	} else {
		// Use highest priority channels
		candidateChannels = channels[:priorityGroupEnd]
	}

	return s.SelectChannel(candidateChannels)
}

// betterChannel compares two channels and returns the better one
func (s *SmartChannelSelector) betterChannel(a, b *Channel) *Channel {
	scoreA := s.getChannelScore(a)
	scoreB := s.getChannelScore(b)

	if scoreA >= scoreB {
		return a
	}
	return b
}

// getChannelScore calculates the score for a channel
func (s *SmartChannelSelector) getChannelScore(channel *Channel) float64 {
	health := s.tracker.GetHealth(channel.Id)
	if health == nil {
		// No health data, use weight only
		weight := 1.0
		if channel.Weight != nil {
			weight = float64(*channel.Weight)
		}
		if weight <= 0 {
			weight = 1.0
		}
		return weight * 1000 // Base score for unknown channels
	}

	weight := 1.0
	if channel.Weight != nil {
		weight = float64(*channel.Weight)
	}
	if weight <= 0 {
		weight = 1.0
	}

	return health.Score(weight)
}

// SelectChannelWithStrategy selects the best channel using a specific strategy
func (s *SmartChannelSelector) SelectChannelWithStrategy(channels []*Channel, strategy SelectionStrategy) *Channel {
	n := len(channels)
	if n == 0 {
		return nil
	}
	if n == 1 {
		return channels[0]
	}
	if n == 2 {
		return s.betterChannelWithStrategy(channels[0], channels[1], strategy)
	}

	// P2C with strategy
	idx1 := rand.Intn(n)
	idx2 := rand.Intn(n - 1)
	if idx2 >= idx1 {
		idx2++
	}

	return s.betterChannelWithStrategy(channels[idx1], channels[idx2], strategy)
}

// betterChannelWithStrategy compares two channels using strategy weights
func (s *SmartChannelSelector) betterChannelWithStrategy(a, b *Channel, strategy SelectionStrategy) *Channel {
	scoreA := s.getChannelScoreWithStrategy(a, strategy)
	scoreB := s.getChannelScoreWithStrategy(b, strategy)

	if scoreA >= scoreB {
		return a
	}
	return b
}

// getChannelScoreWithStrategy calculates score using strategy weights
func (s *SmartChannelSelector) getChannelScoreWithStrategy(channel *Channel, strategy SelectionStrategy) float64 {
	health := s.tracker.GetHealth(channel.Id)
	
	weight := 1.0
	if channel.Weight != nil {
		weight = float64(*channel.Weight)
	}
	if weight <= 0 {
		weight = 1.0
	}

	// Get cost ratio from billing (simplified: use weight as inverse cost proxy)
	costRatio := 1.0 / weight

	if health == nil {
		// No health data, return base score adjusted by strategy
		baseScore := weight * 1000
		// Apply cost preference for cost strategy
		if strategy.CostWeight > 0.4 {
			baseScore *= (1.0 + strategy.CostWeight)
		}
		return baseScore
	}

	return health.ScoreWithStrategy(weight, strategy, costRatio)
}

// CacheGetChannelWithStrategy gets a channel using strategy-based selection
func CacheGetChannelWithStrategy(group string, model string, strategyName string) (*Channel, error) {
	channelSyncLock.RLock()
	channels := group2model2channels[group][model]
	channelSyncLock.RUnlock()

	if len(channels) == 0 {
		return nil, ErrNoAvailableChannel
	}

	strategy := GetStrategy(strategyName)
	selector := GetSmartChannelSelector()
	channel := selector.SelectChannelWithStrategy(channels, strategy)

	if channel == nil {
		return nil, ErrNoAvailableChannel
	}

	return channel, nil
}

// Global smart selector
var (
	smartSelector     *SmartChannelSelector
	smartSelectorOnce sync.Once
)

// GetSmartChannelSelector returns the global smart channel selector
func GetSmartChannelSelector() *SmartChannelSelector {
	smartSelectorOnce.Do(func() {
		smartSelector = NewSmartChannelSelector()
	})
	return smartSelector
}

// CacheGetSmartChannel gets a channel using smart selection
// This is the enhanced version of CacheGetRandomSatisfiedChannel
func CacheGetSmartChannel(group string, model string, ignoreFirstPriority bool) (*Channel, error) {
	channelSyncLock.RLock()
	channels := group2model2channels[group][model]
	channelSyncLock.RUnlock()

	if len(channels) == 0 {
		// Fallback to database query
		return GetRandomSatisfiedChannel(group, model, ignoreFirstPriority)
	}

	selector := GetSmartChannelSelector()
	channel := selector.SelectChannelWithPriority(channels, ignoreFirstPriority)

	if channel == nil {
		return nil, ErrNoAvailableChannel
	}

	return channel, nil
}

// RecordChannelResult records the result of a channel request
// Should be called after each request to update health metrics
func RecordChannelResult(channelId int, latency time.Duration, success bool) {
	tracker := GetHealthTracker()
	if success {
		tracker.RecordSuccess(channelId, latency)
	} else {
		tracker.RecordFailure(channelId, latency)
	}
}

// GetChannelHealthStats returns health stats for all tracked channels
func GetChannelHealthStats() map[int]map[string]interface{} {
	tracker := GetHealthTracker()
	tracker.mu.RLock()
	defer tracker.mu.RUnlock()

	stats := make(map[int]map[string]interface{})
	for id, h := range tracker.channels {
		h.mu.RLock()
		stats[id] = map[string]interface{}{
			"total_requests":   h.TotalRequests,
			"success_count":    h.SuccessCount,
			"failure_count":    h.FailureCount,
			"success_rate":     h.SuccessRate(),
			"avg_latency_ms":   h.AvgLatency().Milliseconds(),
			"last_latency_ms":  h.LastLatency.Milliseconds(),
			"consecutive_fail": h.ConsecutiveFail,
			"last_error":       h.LastError,
			"last_success":     h.LastSuccess,
			"score":            h.Score(1.0),
		}
		h.mu.RUnlock()
	}

	return stats
}

// Error for no available channel
var ErrNoAvailableChannel = &NoChannelError{}

type NoChannelError struct{}

func (e *NoChannelError) Error() string {
	return "no available channel"
}
