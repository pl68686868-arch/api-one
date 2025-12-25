package model

// ChannelSelectionInfo contains information about channel selection
type ChannelSelectionInfo struct {
	Channel          *Channel
	AvailableCount   int     // Number of channels available for this model
	SelectionScore   float64 // Score used to select this channel
}

// CacheGetHealthiestChannel selects the channel with the best health metrics
// Returns the selected channel along with selection metadata
func CacheGetHealthiestChannel(group string, model string) (*ChannelSelectionInfo, error) {
	channel, err := CacheGetSmartChannel(group, model, false)
	if err != nil {
		return nil, err
	}
	
	// Get available channel count
	channelSyncLock.RLock()
	channels := group2model2channels[group][model]
	availableCount := len(channels)
	channelSyncLock.RUnlock()
	
	// Calculate selection score for this channel
	tracker := GetHealthTracker()
	health := tracker.GetHealth(channel.Id)
	var score float64
	if health != nil {
		weight := 1.0
		if channel.Weight != nil && *channel.Weight > 0 {
			weight = float64(*channel.Weight)
		}
		score = health.Score(weight)
	}
	
	return &ChannelSelectionInfo{
		Channel:        channel,
		AvailableCount: availableCount,
		SelectionScore: score,
	}, nil
}
