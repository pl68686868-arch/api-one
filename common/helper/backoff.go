package helper

import (
	"math"
	"math/rand"
	"time"
)

// BackoffConfig holds configuration for exponential backoff
type BackoffConfig struct {
	// InitialInterval is the first backoff interval
	InitialInterval time.Duration
	// MaxInterval is the maximum backoff interval
	MaxInterval time.Duration
	// Multiplier is the factor by which the interval increases
	Multiplier float64
	// JitterFactor is the random jitter factor (0.0-1.0)
	// A value of 0.3 means ±30% jitter
	JitterFactor float64
	// MaxRetries is the maximum number of retries (0 = unlimited)
	MaxRetries int
}

// DefaultBackoffConfig returns sensible defaults for API retry
func DefaultBackoffConfig() BackoffConfig {
	return BackoffConfig{
		InitialInterval: 100 * time.Millisecond,
		MaxInterval:     30 * time.Second,
		Multiplier:      2.0,
		JitterFactor:    0.3,
		MaxRetries:      3,
	}
}

// AggressiveBackoffConfig returns config for quick retries
func AggressiveBackoffConfig() BackoffConfig {
	return BackoffConfig{
		InitialInterval: 50 * time.Millisecond,
		MaxInterval:     5 * time.Second,
		Multiplier:      1.5,
		JitterFactor:    0.2,
		MaxRetries:      5,
	}
}

// ConservativeBackoffConfig returns config for slow retries
func ConservativeBackoffConfig() BackoffConfig {
	return BackoffConfig{
		InitialInterval: 500 * time.Millisecond,
		MaxInterval:     60 * time.Second,
		Multiplier:      2.5,
		JitterFactor:    0.4,
		MaxRetries:      3,
	}
}

// ExponentialBackoff calculates the backoff duration for a given attempt
// attempt is 0-indexed (first retry = 0)
func ExponentialBackoff(attempt int, config BackoffConfig) time.Duration {
	if attempt < 0 {
		attempt = 0
	}

	// Calculate base interval: initial * multiplier^attempt
	interval := float64(config.InitialInterval) * math.Pow(config.Multiplier, float64(attempt))

	// Apply max cap
	if interval > float64(config.MaxInterval) {
		interval = float64(config.MaxInterval)
	}

	// Apply jitter
	if config.JitterFactor > 0 {
		jitter := interval * config.JitterFactor * (2*rand.Float64() - 1)
		interval += jitter
	}

	// Ensure non-negative
	if interval < 0 {
		interval = float64(config.InitialInterval)
	}

	return time.Duration(interval)
}

// ExponentialBackoffSimple calculates backoff with default config
func ExponentialBackoffSimple(attempt int) time.Duration {
	return ExponentialBackoff(attempt, DefaultBackoffConfig())
}

// BackoffWithReset calculates backoff with reset after max interval
// Useful for long-running retry loops
func BackoffWithReset(attempt int, config BackoffConfig) (time.Duration, int) {
	// If we've reached max retries, reset
	if config.MaxRetries > 0 && attempt >= config.MaxRetries {
		return config.InitialInterval, 0
	}
	return ExponentialBackoff(attempt, config), attempt
}

// RetryFunc is a function that can be retried
type RetryFunc func() error

// ShouldRetryFunc determines if an error should trigger a retry
type ShouldRetryFunc func(err error) bool

// RetryWithBackoff retries a function with exponential backoff
// Returns the error from the last attempt if all retries fail
func RetryWithBackoff(config BackoffConfig, fn RetryFunc, shouldRetry ShouldRetryFunc) error {
	var lastErr error

	for attempt := 0; config.MaxRetries == 0 || attempt <= config.MaxRetries; attempt++ {
		err := fn()
		if err == nil {
			return nil
		}

		lastErr = err

		// Check if we should retry this error
		if shouldRetry != nil && !shouldRetry(err) {
			return err
		}

		// Don't wait after max retries
		if config.MaxRetries > 0 && attempt >= config.MaxRetries {
			break
		}

		// Calculate and apply backoff
		backoff := ExponentialBackoff(attempt, config)
		time.Sleep(backoff)
	}

	return lastErr
}

// RetryableError wraps an error to indicate it's retryable
type RetryableError struct {
	Err error
}

func (e *RetryableError) Error() string {
	return e.Err.Error()
}

func (e *RetryableError) Unwrap() error {
	return e.Err
}

// NewRetryableError creates a new RetryableError
func NewRetryableError(err error) *RetryableError {
	return &RetryableError{Err: err}
}

// IsRetryable checks if an error is marked as retryable
func IsRetryable(err error) bool {
	_, ok := err.(*RetryableError)
	return ok
}

// CalculateBackoffSequence returns the full sequence of backoff durations
// Useful for logging/debugging
func CalculateBackoffSequence(config BackoffConfig) []time.Duration {
	maxRetries := config.MaxRetries
	if maxRetries <= 0 {
		maxRetries = 10 // Cap for display purposes
	}

	sequence := make([]time.Duration, maxRetries)
	for i := 0; i < maxRetries; i++ {
		sequence[i] = ExponentialBackoff(i, config)
	}
	return sequence
}

// BackoffState maintains state for retry operations
type BackoffState struct {
	Config       BackoffConfig
	Attempt      int
	LastBackoff  time.Duration
	TotalBackoff time.Duration
	StartTime    time.Time
}

// NewBackoffState creates a new backoff state
func NewBackoffState(config BackoffConfig) *BackoffState {
	return &BackoffState{
		Config:    config,
		StartTime: time.Now(),
	}
}

// Next calculates and applies the next backoff
// Returns false if max retries exceeded
func (s *BackoffState) Next() (time.Duration, bool) {
	if s.Config.MaxRetries > 0 && s.Attempt >= s.Config.MaxRetries {
		return 0, false
	}

	backoff := ExponentialBackoff(s.Attempt, s.Config)
	s.Attempt++
	s.LastBackoff = backoff
	s.TotalBackoff += backoff
	return backoff, true
}

// WaitNext calculates the next backoff and sleeps
// Returns false if max retries exceeded (doesn't sleep in that case)
func (s *BackoffState) WaitNext() bool {
	backoff, ok := s.Next()
	if !ok {
		return false
	}
	time.Sleep(backoff)
	return true
}

// Reset resets the backoff state
func (s *BackoffState) Reset() {
	s.Attempt = 0
	s.LastBackoff = 0
	s.TotalBackoff = 0
	s.StartTime = time.Now()
}

// Elapsed returns the total time since the first attempt
func (s *BackoffState) Elapsed() time.Duration {
	return time.Since(s.StartTime)
}

// RemainingRetries returns the number of retries remaining
// Returns -1 if unlimited retries
func (s *BackoffState) RemainingRetries() int {
	if s.Config.MaxRetries <= 0 {
		return -1
	}
	remaining := s.Config.MaxRetries - s.Attempt
	if remaining < 0 {
		return 0
	}
	return remaining
}
