package model

// CacheGetHealthiestChannel selects the channel with the best health metrics
// This is an alias for CacheGetSmartChannel with health-based selection
func CacheGetHealthiestChannel(group string, model string) (*Channel, error) {
	return CacheGetSmartChannel(group, model, false)
}
