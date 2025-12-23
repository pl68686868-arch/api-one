package circuitbreaker

import (
	"errors"
	"sync"
	"sync/atomic"
	"time"
)

// State represents the current state of a circuit breaker
type State int32

const (
	// StateClosed - circuit breaker is closed, requests flow normally
	StateClosed State = iota
	// StateOpen - circuit breaker is open, requests are rejected immediately
	StateOpen
	// StateHalfOpen - circuit breaker is testing, limited requests allowed
	StateHalfOpen
)

// String returns the string representation of the state
func (s State) String() string {
	switch s {
	case StateClosed:
		return "CLOSED"
	case StateOpen:
		return "OPEN"
	case StateHalfOpen:
		return "HALF-OPEN"
	default:
		return "UNKNOWN"
	}
}

var (
	// ErrCircuitOpen is returned when the circuit breaker is open
	ErrCircuitOpen = errors.New("circuit breaker is open")
	// ErrTooManyRequests is returned when too many requests are made in half-open state
	ErrTooManyRequests = errors.New("too many requests in half-open state")
)

// Settings configures the circuit breaker behavior
type Settings struct {
	// Name is the identifier for this circuit breaker
	Name string

	// MaxFailures is the maximum number of failures before opening the circuit
	MaxFailures int

	// FailureRatio is the failure ratio threshold (0.0-1.0) before opening
	// If set, this takes precedence over MaxFailures when MinSamples is reached
	FailureRatio float64

	// MinSamples is the minimum number of samples needed before using FailureRatio
	MinSamples int

	// Timeout is the duration the circuit stays open before transitioning to half-open
	Timeout time.Duration

	// HalfOpenMaxRequests is the maximum number of requests allowed in half-open state
	HalfOpenMaxRequests int

	// SuccessThreshold is the number of consecutive successes needed in half-open to close
	SuccessThreshold int

	// OnStateChange is called when the circuit breaker changes state
	OnStateChange func(name string, from State, to State)
}

// DefaultSettings returns sensible default settings
func DefaultSettings(name string) Settings {
	return Settings{
		Name:                name,
		MaxFailures:         5,
		FailureRatio:        0.5,
		MinSamples:          10,
		Timeout:             30 * time.Second,
		HalfOpenMaxRequests: 3,
		SuccessThreshold:    2,
	}
}

// Counts holds the counts for the circuit breaker
type Counts struct {
	Requests             uint64
	TotalSuccesses       uint64
	TotalFailures        uint64
	ConsecutiveSuccesses uint32
	ConsecutiveFailures  uint32
}

// CircuitBreaker implements the circuit breaker pattern
type CircuitBreaker struct {
	settings Settings

	state           int32 // atomic State
	counts          Counts
	lastStateChange time.Time
	lastFailure     time.Time
	halfOpenCount   int32 // atomic

	mu sync.RWMutex
}

// New creates a new CircuitBreaker with the given settings
func New(settings Settings) *CircuitBreaker {
	if settings.MaxFailures <= 0 {
		settings.MaxFailures = 5
	}
	if settings.Timeout <= 0 {
		settings.Timeout = 30 * time.Second
	}
	if settings.HalfOpenMaxRequests <= 0 {
		settings.HalfOpenMaxRequests = 3
	}
	if settings.SuccessThreshold <= 0 {
		settings.SuccessThreshold = 2
	}

	return &CircuitBreaker{
		settings:        settings,
		state:           int32(StateClosed),
		lastStateChange: time.Now(),
	}
}

// State returns the current state of the circuit breaker
func (cb *CircuitBreaker) State() State {
	return State(atomic.LoadInt32(&cb.state))
}

// Counts returns a copy of the current counts
func (cb *CircuitBreaker) Counts() Counts {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.counts
}

// Allow checks if a request should be allowed through
func (cb *CircuitBreaker) Allow() error {
	state := cb.State()

	switch state {
	case StateClosed:
		return nil

	case StateOpen:
		// Check if timeout has passed
		cb.mu.RLock()
		lastChange := cb.lastStateChange
		cb.mu.RUnlock()

		if time.Since(lastChange) >= cb.settings.Timeout {
			// Transition to half-open
			cb.transitionTo(StateHalfOpen)
			return cb.allowHalfOpen()
		}
		return ErrCircuitOpen

	case StateHalfOpen:
		return cb.allowHalfOpen()
	}

	return nil
}

// allowHalfOpen checks if a request should be allowed in half-open state
func (cb *CircuitBreaker) allowHalfOpen() error {
	count := atomic.AddInt32(&cb.halfOpenCount, 1)
	if count > int32(cb.settings.HalfOpenMaxRequests) {
		atomic.AddInt32(&cb.halfOpenCount, -1)
		return ErrTooManyRequests
	}
	return nil
}

// RecordSuccess records a successful request
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.counts.Requests++
	cb.counts.TotalSuccesses++
	cb.counts.ConsecutiveSuccesses++
	cb.counts.ConsecutiveFailures = 0

	state := State(atomic.LoadInt32(&cb.state))

	if state == StateHalfOpen {
		atomic.AddInt32(&cb.halfOpenCount, -1)
		if cb.counts.ConsecutiveSuccesses >= uint32(cb.settings.SuccessThreshold) {
			cb.transitionToLocked(StateClosed)
		}
	}
}

// RecordFailure records a failed request
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.counts.Requests++
	cb.counts.TotalFailures++
	cb.counts.ConsecutiveFailures++
	cb.counts.ConsecutiveSuccesses = 0
	cb.lastFailure = time.Now()

	state := State(atomic.LoadInt32(&cb.state))

	switch state {
	case StateClosed:
		if cb.shouldOpen() {
			cb.transitionToLocked(StateOpen)
		}

	case StateHalfOpen:
		atomic.AddInt32(&cb.halfOpenCount, -1)
		// Any failure in half-open state reopens the circuit
		cb.transitionToLocked(StateOpen)
	}
}

// shouldOpen determines if the circuit should open based on failure counts/ratio
func (cb *CircuitBreaker) shouldOpen() bool {
	// Check consecutive failures
	if cb.counts.ConsecutiveFailures >= uint32(cb.settings.MaxFailures) {
		return true
	}

	// Check failure ratio if enough samples
	if cb.settings.FailureRatio > 0 && cb.counts.Requests >= uint64(cb.settings.MinSamples) {
		ratio := float64(cb.counts.TotalFailures) / float64(cb.counts.Requests)
		if ratio >= cb.settings.FailureRatio {
			return true
		}
	}

	return false
}

// transitionTo changes the state (thread-safe, acquires lock)
func (cb *CircuitBreaker) transitionTo(newState State) {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.transitionToLocked(newState)
}

// transitionToLocked changes the state (assumes lock is already held)
func (cb *CircuitBreaker) transitionToLocked(newState State) {
	oldState := State(atomic.LoadInt32(&cb.state))
	if oldState == newState {
		return
	}

	atomic.StoreInt32(&cb.state, int32(newState))
	cb.lastStateChange = time.Now()

	// Reset half-open counter when entering half-open
	if newState == StateHalfOpen {
		atomic.StoreInt32(&cb.halfOpenCount, 0)
	}

	// Reset counts when closing
	if newState == StateClosed {
		cb.counts = Counts{}
	}

	// Call state change callback
	if cb.settings.OnStateChange != nil {
		go cb.settings.OnStateChange(cb.settings.Name, oldState, newState)
	}
}

// Execute runs the given function if the circuit breaker allows it
// It automatically records success or failure based on the returned error
func (cb *CircuitBreaker) Execute(fn func() error) error {
	if err := cb.Allow(); err != nil {
		return err
	}

	err := fn()
	if err != nil {
		cb.RecordFailure()
		return err
	}

	cb.RecordSuccess()
	return nil
}

// Reset resets the circuit breaker to its initial state
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	atomic.StoreInt32(&cb.state, int32(StateClosed))
	cb.counts = Counts{}
	cb.lastStateChange = time.Now()
	atomic.StoreInt32(&cb.halfOpenCount, 0)
}

// BreakerManager manages multiple circuit breakers
type BreakerManager struct {
	breakers map[string]*CircuitBreaker
	mu       sync.RWMutex
	factory  func(name string) Settings
}

// NewManager creates a new BreakerManager
func NewManager(factory func(name string) Settings) *BreakerManager {
	if factory == nil {
		factory = DefaultSettings
	}
	return &BreakerManager{
		breakers: make(map[string]*CircuitBreaker),
		factory:  factory,
	}
}

// Get returns the circuit breaker for the given name, creating one if needed
func (m *BreakerManager) Get(name string) *CircuitBreaker {
	m.mu.RLock()
	cb, exists := m.breakers[name]
	m.mu.RUnlock()

	if exists {
		return cb
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Double-check after acquiring write lock
	if cb, exists = m.breakers[name]; exists {
		return cb
	}

	cb = New(m.factory(name))
	m.breakers[name] = cb
	return cb
}

// GetAll returns all circuit breakers
func (m *BreakerManager) GetAll() map[string]*CircuitBreaker {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string]*CircuitBreaker, len(m.breakers))
	for k, v := range m.breakers {
		result[k] = v
	}
	return result
}

// Reset resets the circuit breaker for the given name
func (m *BreakerManager) Reset(name string) {
	m.mu.RLock()
	cb, exists := m.breakers[name]
	m.mu.RUnlock()

	if exists {
		cb.Reset()
	}
}

// ResetAll resets all circuit breakers
func (m *BreakerManager) ResetAll() {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, cb := range m.breakers {
		cb.Reset()
	}
}

// Stats returns statistics for all circuit breakers
func (m *BreakerManager) Stats() map[string]map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stats := make(map[string]map[string]interface{})
	for name, cb := range m.breakers {
		counts := cb.Counts()
		stats[name] = map[string]interface{}{
			"state":                 cb.State().String(),
			"requests":              counts.Requests,
			"successes":             counts.TotalSuccesses,
			"failures":              counts.TotalFailures,
			"consecutive_successes": counts.ConsecutiveSuccesses,
			"consecutive_failures":  counts.ConsecutiveFailures,
		}
	}
	return stats
}

// Global channel circuit breaker manager
var channelBreakerManager *BreakerManager

// GetChannelBreakerManager returns the global channel circuit breaker manager
func GetChannelBreakerManager() *BreakerManager {
	if channelBreakerManager == nil {
		channelBreakerManager = NewManager(func(name string) Settings {
			s := DefaultSettings(name)
			s.MaxFailures = 5
			s.Timeout = 30 * time.Second
			s.SuccessThreshold = 2
			s.OnStateChange = func(name string, from State, to State) {
				// Log state changes
				// Can be enhanced to send alerts
			}
			return s
		})
	}
	return channelBreakerManager
}
