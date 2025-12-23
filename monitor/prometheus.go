package monitor

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/common/config"
)

// MetricsCollector collects and exposes Prometheus-compatible metrics
type MetricsCollector struct {
	// Request metrics
	requestsTotal     *CounterVec
	requestDuration   *HistogramVec
	requestsInFlight  *GaugeVec
	
	// Channel metrics
	channelRequests   *CounterVec
	channelErrors     *CounterVec
	channelLatency    *HistogramVec
	channelStatus     *GaugeVec
	
	// Token metrics
	tokensUsed        *CounterVec
	quotaUsed         *CounterVec
	
	// System metrics
	activeConnections *Gauge
	
	mu sync.RWMutex
}

// CounterVec is a simple counter vector implementation
type CounterVec struct {
	name   string
	help   string
	labels []string
	values map[string]float64
	mu     sync.RWMutex
}

// HistogramVec is a simple histogram vector implementation
type HistogramVec struct {
	name    string
	help    string
	labels  []string
	buckets []float64
	values  map[string]*histogramData
	mu      sync.RWMutex
}

type histogramData struct {
	bucketCounts []uint64
	sum          float64
	count        uint64
}

// GaugeVec is a simple gauge vector implementation
type GaugeVec struct {
	name   string
	help   string
	labels []string
	values map[string]float64
	mu     sync.RWMutex
}

// Gauge is a simple gauge implementation
type Gauge struct {
	name  string
	help  string
	value float64
	mu    sync.RWMutex
}

// NewCounterVec creates a new counter vector
func NewCounterVec(name, help string, labels []string) *CounterVec {
	return &CounterVec{
		name:   name,
		help:   help,
		labels: labels,
		values: make(map[string]float64),
	}
}

// Inc increments the counter
func (c *CounterVec) Inc(labelValues ...string) {
	c.Add(1, labelValues...)
}

// Add adds a value to the counter
func (c *CounterVec) Add(v float64, labelValues ...string) {
	key := labelsToKey(labelValues)
	c.mu.Lock()
	c.values[key] += v
	c.mu.Unlock()
}

// NewHistogramVec creates a new histogram vector
func NewHistogramVec(name, help string, labels []string, buckets []float64) *HistogramVec {
	if buckets == nil {
		buckets = []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60}
	}
	return &HistogramVec{
		name:    name,
		help:    help,
		labels:  labels,
		buckets: buckets,
		values:  make(map[string]*histogramData),
	}
}

// Observe records a value in the histogram
func (h *HistogramVec) Observe(v float64, labelValues ...string) {
	key := labelsToKey(labelValues)
	h.mu.Lock()
	data, exists := h.values[key]
	if !exists {
		data = &histogramData{
			bucketCounts: make([]uint64, len(h.buckets)+1),
		}
		h.values[key] = data
	}
	
	// Find the bucket
	for i, bucket := range h.buckets {
		if v <= bucket {
			data.bucketCounts[i]++
			break
		}
	}
	// +Inf bucket
	data.bucketCounts[len(h.buckets)]++
	
	data.sum += v
	data.count++
	h.mu.Unlock()
}

// NewGaugeVec creates a new gauge vector
func NewGaugeVec(name, help string, labels []string) *GaugeVec {
	return &GaugeVec{
		name:   name,
		help:   help,
		labels: labels,
		values: make(map[string]float64),
	}
}

// Set sets the gauge value
func (g *GaugeVec) Set(v float64, labelValues ...string) {
	key := labelsToKey(labelValues)
	g.mu.Lock()
	g.values[key] = v
	g.mu.Unlock()
}

// Inc increments the gauge
func (g *GaugeVec) Inc(labelValues ...string) {
	key := labelsToKey(labelValues)
	g.mu.Lock()
	g.values[key]++
	g.mu.Unlock()
}

// Dec decrements the gauge
func (g *GaugeVec) Dec(labelValues ...string) {
	key := labelsToKey(labelValues)
	g.mu.Lock()
	g.values[key]--
	g.mu.Unlock()
}

// NewGauge creates a new gauge
func NewGauge(name, help string) *Gauge {
	return &Gauge{
		name: name,
		help: help,
	}
}

// Set sets the gauge value
func (g *Gauge) Set(v float64) {
	g.mu.Lock()
	g.value = v
	g.mu.Unlock()
}

// Inc increments the gauge
func (g *Gauge) Inc() {
	g.mu.Lock()
	g.value++
	g.mu.Unlock()
}

// Dec decrements the gauge
func (g *Gauge) Dec() {
	g.mu.Lock()
	g.value--
	g.mu.Unlock()
}

func labelsToKey(labels []string) string {
	if len(labels) == 0 {
		return ""
	}
	key := labels[0]
	for i := 1; i < len(labels); i++ {
		key += "|" + labels[i]
	}
	return key
}

var (
	collector     *MetricsCollector
	collectorOnce sync.Once
)

// GetMetricsCollector returns the singleton metrics collector
func GetMetricsCollector() *MetricsCollector {
	collectorOnce.Do(func() {
		collector = &MetricsCollector{
			requestsTotal: NewCounterVec(
				"oneapi_requests_total",
				"Total number of requests",
				[]string{"method", "path", "status"},
			),
			requestDuration: NewHistogramVec(
				"oneapi_request_duration_seconds",
				"Request duration in seconds",
				[]string{"method", "path"},
				[]float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60},
			),
			requestsInFlight: NewGaugeVec(
				"oneapi_requests_in_flight",
				"Number of requests currently being processed",
				[]string{"path"},
			),
			channelRequests: NewCounterVec(
				"oneapi_channel_requests_total",
				"Total number of requests per channel",
				[]string{"channel_id", "channel_name", "model"},
			),
			channelErrors: NewCounterVec(
				"oneapi_channel_errors_total",
				"Total number of errors per channel",
				[]string{"channel_id", "channel_name", "model", "error_type"},
			),
			channelLatency: NewHistogramVec(
				"oneapi_channel_latency_seconds",
				"Channel response latency in seconds",
				[]string{"channel_id", "channel_name", "model"},
				[]float64{0.1, 0.5, 1, 2, 5, 10, 30, 60, 120},
			),
			channelStatus: NewGaugeVec(
				"oneapi_channel_status",
				"Channel status (1=enabled, 0=disabled)",
				[]string{"channel_id", "channel_name"},
			),
			tokensUsed: NewCounterVec(
				"oneapi_tokens_used_total",
				"Total tokens used",
				[]string{"model", "type"}, // type: prompt, completion
			),
			quotaUsed: NewCounterVec(
				"oneapi_quota_used_total",
				"Total quota used",
				[]string{"user_id", "model"},
			),
			activeConnections: NewGauge(
				"oneapi_active_connections",
				"Number of active connections",
			),
		}
	})
	return collector
}

// RecordRequest records a request with its duration and status
func (m *MetricsCollector) RecordRequest(method, path string, status int, duration time.Duration) {
	statusStr := strconv.Itoa(status)
	m.requestsTotal.Inc(method, path, statusStr)
	m.requestDuration.Observe(duration.Seconds(), method, path)
}

// RecordChannelRequest records a channel request
func (m *MetricsCollector) RecordChannelRequest(channelID int, channelName, model string, duration time.Duration, success bool) {
	idStr := strconv.Itoa(channelID)
	m.channelRequests.Inc(idStr, channelName, model)
	m.channelLatency.Observe(duration.Seconds(), idStr, channelName, model)
	
	if !success {
		m.channelErrors.Inc(idStr, channelName, model, "request_failed")
	}
}

// RecordChannelError records a channel error
func (m *MetricsCollector) RecordChannelError(channelID int, channelName, model, errorType string) {
	idStr := strconv.Itoa(channelID)
	m.channelErrors.Inc(idStr, channelName, model, errorType)
}

// SetChannelStatus sets the channel status
func (m *MetricsCollector) SetChannelStatus(channelID int, channelName string, enabled bool) {
	idStr := strconv.Itoa(channelID)
	value := 0.0
	if enabled {
		value = 1.0
	}
	m.channelStatus.Set(value, idStr, channelName)
}

// RecordTokens records token usage
func (m *MetricsCollector) RecordTokens(model string, promptTokens, completionTokens int) {
	m.tokensUsed.Add(float64(promptTokens), model, "prompt")
	m.tokensUsed.Add(float64(completionTokens), model, "completion")
}

// RecordQuota records quota usage
func (m *MetricsCollector) RecordQuota(userID int, model string, quota int) {
	m.quotaUsed.Add(float64(quota), strconv.Itoa(userID), model)
}

// IncrementInFlight increments the in-flight request count
func (m *MetricsCollector) IncrementInFlight(path string) {
	m.requestsInFlight.Inc(path)
}

// DecrementInFlight decrements the in-flight request count
func (m *MetricsCollector) DecrementInFlight(path string) {
	m.requestsInFlight.Dec(path)
}

// IncrementConnections increments active connections
func (m *MetricsCollector) IncrementConnections() {
	m.activeConnections.Inc()
}

// DecrementConnections decrements active connections
func (m *MetricsCollector) DecrementConnections() {
	m.activeConnections.Dec()
}

// MetricsHandler returns a Gin handler for the /metrics endpoint
func MetricsHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !config.EnableMetric {
			c.String(http.StatusNotFound, "Metrics not enabled")
			return
		}
		
		m := GetMetricsCollector()
		output := m.generatePrometheusOutput()
		c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(output))
	}
}

// generatePrometheusOutput generates Prometheus-compatible output
func (m *MetricsCollector) generatePrometheusOutput() string {
	var output string
	
	// Counters
	output += formatCounter(m.requestsTotal)
	output += formatCounter(m.channelRequests)
	output += formatCounter(m.channelErrors)
	output += formatCounter(m.tokensUsed)
	output += formatCounter(m.quotaUsed)
	
	// Histograms
	output += formatHistogram(m.requestDuration)
	output += formatHistogram(m.channelLatency)
	
	// Gauges
	output += formatGaugeVec(m.requestsInFlight)
	output += formatGaugeVec(m.channelStatus)
	output += formatGauge(m.activeConnections)
	
	return output
}

func formatCounter(c *CounterVec) string {
	if c == nil {
		return ""
	}
	
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	if len(c.values) == 0 {
		return ""
	}
	
	output := "# HELP " + c.name + " " + c.help + "\n"
	output += "# TYPE " + c.name + " counter\n"
	
	for key, value := range c.values {
		labels := formatLabels(c.labels, key)
		output += c.name + labels + " " + strconv.FormatFloat(value, 'f', -1, 64) + "\n"
	}
	
	return output
}

func formatHistogram(h *HistogramVec) string {
	if h == nil {
		return ""
	}
	
	h.mu.RLock()
	defer h.mu.RUnlock()
	
	if len(h.values) == 0 {
		return ""
	}
	
	output := "# HELP " + h.name + " " + h.help + "\n"
	output += "# TYPE " + h.name + " histogram\n"
	
	for key, data := range h.values {
		baseLabels := formatLabelsBase(h.labels, key)
		
		// Bucket values
		cumulative := uint64(0)
		for i, count := range data.bucketCounts[:len(h.buckets)] {
			cumulative += count
			le := strconv.FormatFloat(h.buckets[i], 'f', -1, 64)
			output += h.name + "_bucket{" + baseLabels + ",le=\"" + le + "\"} " + strconv.FormatUint(cumulative, 10) + "\n"
		}
		cumulative += data.bucketCounts[len(h.buckets)]
		output += h.name + "_bucket{" + baseLabels + ",le=\"+Inf\"} " + strconv.FormatUint(cumulative, 10) + "\n"
		
		// Sum and count
		output += h.name + "_sum{" + baseLabels + "} " + strconv.FormatFloat(data.sum, 'f', -1, 64) + "\n"
		output += h.name + "_count{" + baseLabels + "} " + strconv.FormatUint(data.count, 10) + "\n"
	}
	
	return output
}

func formatGaugeVec(g *GaugeVec) string {
	if g == nil {
		return ""
	}
	
	g.mu.RLock()
	defer g.mu.RUnlock()
	
	if len(g.values) == 0 {
		return ""
	}
	
	output := "# HELP " + g.name + " " + g.help + "\n"
	output += "# TYPE " + g.name + " gauge\n"
	
	for key, value := range g.values {
		labels := formatLabels(g.labels, key)
		output += g.name + labels + " " + strconv.FormatFloat(value, 'f', -1, 64) + "\n"
	}
	
	return output
}

func formatGauge(g *Gauge) string {
	if g == nil {
		return ""
	}
	
	g.mu.RLock()
	defer g.mu.RUnlock()
	
	output := "# HELP " + g.name + " " + g.help + "\n"
	output += "# TYPE " + g.name + " gauge\n"
	output += g.name + " " + strconv.FormatFloat(g.value, 'f', -1, 64) + "\n"
	
	return output
}

func formatLabels(labelNames []string, key string) string {
	if len(labelNames) == 0 || key == "" {
		return ""
	}
	return "{" + formatLabelsBase(labelNames, key) + "}"
}

func formatLabelsBase(labelNames []string, key string) string {
	if len(labelNames) == 0 || key == "" {
		return ""
	}
	
	values := splitKey(key)
	output := ""
	for i, name := range labelNames {
		if i > 0 {
			output += ","
		}
		value := ""
		if i < len(values) {
			value = values[i]
		}
		output += name + "=\"" + escapeLabel(value) + "\""
	}
	return output
}

func splitKey(key string) []string {
	var result []string
	current := ""
	for _, c := range key {
		if c == '|' {
			result = append(result, current)
			current = ""
		} else {
			current += string(c)
		}
	}
	result = append(result, current)
	return result
}

func escapeLabel(s string) string {
	// Escape special characters in label values
	result := ""
	for _, c := range s {
		switch c {
		case '\\':
			result += "\\\\"
		case '"':
			result += "\\\""
		case '\n':
			result += "\\n"
		default:
			result += string(c)
		}
	}
	return result
}

// MetricsMiddleware creates a middleware that records request metrics
func MetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !config.EnableMetric {
			c.Next()
			return
		}
		
		m := GetMetricsCollector()
		path := c.Request.URL.Path
		method := c.Request.Method
		
		m.IncrementInFlight(path)
		start := time.Now()
		
		c.Next()
		
		duration := time.Since(start)
		status := c.Writer.Status()
		
		m.DecrementInFlight(path)
		m.RecordRequest(method, path, status, duration)
	}
}
