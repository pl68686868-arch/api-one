package client

import (
	"crypto/tls"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/logger"
)

// ProviderConfig holds configuration for a specific provider's connection pool
type ProviderConfig struct {
	Name               string
	MaxIdleConns       int
	MaxIdleConnsPerHost int
	MaxConnsPerHost    int
	IdleConnTimeout    time.Duration
	ResponseTimeout    time.Duration
	TLSHandshakeTimeout time.Duration
	KeepAlive          time.Duration
	DisableKeepAlives  bool
}

// DefaultProviderConfig returns default config for unknown providers
func DefaultProviderConfig(name string) ProviderConfig {
	return ProviderConfig{
		Name:               name,
		MaxIdleConns:       100,
		MaxIdleConnsPerHost: 20,
		MaxConnsPerHost:    50,
		IdleConnTimeout:    90 * time.Second,
		ResponseTimeout:    60 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
		KeepAlive:          30 * time.Second,
		DisableKeepAlives:  false,
	}
}

// Provider-specific configurations optimized for each API's characteristics
var providerConfigs = map[string]ProviderConfig{
	"openai": {
		Name:               "openai",
		MaxIdleConns:       200,
		MaxIdleConnsPerHost: 100,
		MaxConnsPerHost:    150,
		IdleConnTimeout:    120 * time.Second,
		ResponseTimeout:    120 * time.Second, // Streaming can take longer
		TLSHandshakeTimeout: 10 * time.Second,
		KeepAlive:          30 * time.Second,
		DisableKeepAlives:  false,
	},
	"anthropic": {
		Name:               "anthropic",
		MaxIdleConns:       100,
		MaxIdleConnsPerHost: 50,
		MaxConnsPerHost:    100,
		IdleConnTimeout:    120 * time.Second,
		ResponseTimeout:    180 * time.Second, // Claude can be slow
		TLSHandshakeTimeout: 10 * time.Second,
		KeepAlive:          30 * time.Second,
		DisableKeepAlives:  false,
	},
	"azure": {
		Name:               "azure",
		MaxIdleConns:       150,
		MaxIdleConnsPerHost: 80,
		MaxConnsPerHost:    120,
		IdleConnTimeout:    90 * time.Second,
		ResponseTimeout:    90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
		KeepAlive:          30 * time.Second,
		DisableKeepAlives:  false,
	},
	"gemini": {
		Name:               "gemini",
		MaxIdleConns:       100,
		MaxIdleConnsPerHost: 50,
		MaxConnsPerHost:    100,
		IdleConnTimeout:    90 * time.Second,
		ResponseTimeout:    120 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
		KeepAlive:          30 * time.Second,
		DisableKeepAlives:  false,
	},
	"deepseek": {
		Name:               "deepseek",
		MaxIdleConns:       80,
		MaxIdleConnsPerHost: 40,
		MaxConnsPerHost:    80,
		IdleConnTimeout:    90 * time.Second,
		ResponseTimeout:    180 * time.Second, // DeepSeek R1 reasoning can be slow
		TLSHandshakeTimeout: 10 * time.Second,
		KeepAlive:          30 * time.Second,
		DisableKeepAlives:  false,
	},
	"baidu": {
		Name:               "baidu",
		MaxIdleConns:       60,
		MaxIdleConnsPerHost: 30,
		MaxConnsPerHost:    60,
		IdleConnTimeout:    60 * time.Second,
		ResponseTimeout:    90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
		KeepAlive:          30 * time.Second,
		DisableKeepAlives:  false,
	},
	"ali": {
		Name:               "ali",
		MaxIdleConns:       80,
		MaxIdleConnsPerHost: 40,
		MaxConnsPerHost:    80,
		IdleConnTimeout:    90 * time.Second,
		ResponseTimeout:    120 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
		KeepAlive:          30 * time.Second,
		DisableKeepAlives:  false,
	},
	"zhipu": {
		Name:               "zhipu",
		MaxIdleConns:       60,
		MaxIdleConnsPerHost: 30,
		MaxConnsPerHost:    60,
		IdleConnTimeout:    90 * time.Second,
		ResponseTimeout:    90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
		KeepAlive:          30 * time.Second,
		DisableKeepAlives:  false,
	},
}

// ConnectionPoolManager manages per-provider HTTP connection pools
type ConnectionPoolManager struct {
	pools  map[string]*http.Client
	mu     sync.RWMutex
	proxy  *url.URL
}

var (
	poolManager     *ConnectionPoolManager
	poolManagerOnce sync.Once
)

// GetPoolManager returns the singleton connection pool manager
func GetPoolManager() *ConnectionPoolManager {
	poolManagerOnce.Do(func() {
		poolManager = &ConnectionPoolManager{
			pools: make(map[string]*http.Client),
		}
		
		// Parse proxy if configured
		if config.RelayProxy != "" {
			proxyURL, err := url.Parse(config.RelayProxy)
			if err == nil {
				poolManager.proxy = proxyURL
			}
		}
		
		// Pre-initialize pools for known providers
		for name := range providerConfigs {
			poolManager.getOrCreatePool(name)
		}
		
		logger.SysLog("Connection pool manager initialized")
	})
	return poolManager
}

// GetClient returns a configured HTTP client for the given provider
func (m *ConnectionPoolManager) GetClient(providerName string) *http.Client {
	return m.getOrCreatePool(providerName)
}

// getOrCreatePool gets or creates a connection pool for a provider
func (m *ConnectionPoolManager) getOrCreatePool(providerName string) *http.Client {
	m.mu.RLock()
	client, exists := m.pools[providerName]
	m.mu.RUnlock()
	
	if exists {
		return client
	}
	
	m.mu.Lock()
	defer m.mu.Unlock()
	
	// Double-check
	if client, exists = m.pools[providerName]; exists {
		return client
	}
	
	// Create new pool
	cfg, ok := providerConfigs[providerName]
	if !ok {
		cfg = DefaultProviderConfig(providerName)
	}
	
	client = m.createClient(cfg)
	m.pools[providerName] = client
	
	logger.SysLogf("Created connection pool for provider: %s", providerName)
	
	return client
}

// createClient creates an HTTP client with the given configuration
func (m *ConnectionPoolManager) createClient(cfg ProviderConfig) *http.Client {
	dialer := &net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: cfg.KeepAlive,
	}
	
	transport := &http.Transport{
		Proxy:                 m.getProxyFunc(),
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          cfg.MaxIdleConns,
		MaxIdleConnsPerHost:   cfg.MaxIdleConnsPerHost,
		MaxConnsPerHost:       cfg.MaxConnsPerHost,
		IdleConnTimeout:       cfg.IdleConnTimeout,
		TLSHandshakeTimeout:   cfg.TLSHandshakeTimeout,
		ExpectContinueTimeout: 1 * time.Second,
		DisableKeepAlives:     cfg.DisableKeepAlives,
		TLSClientConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
		},
	}
	
	timeout := cfg.ResponseTimeout
	if config.RelayTimeout > 0 {
		timeout = time.Duration(config.RelayTimeout) * time.Second
	}
	
	return &http.Client{
		Transport: transport,
		Timeout:   timeout,
	}
}

// getProxyFunc returns the proxy function if configured
func (m *ConnectionPoolManager) getProxyFunc() func(*http.Request) (*url.URL, error) {
	if m.proxy != nil {
		return http.ProxyURL(m.proxy)
	}
	return http.ProxyFromEnvironment
}

// GetStats returns statistics for all connection pools
func (m *ConnectionPoolManager) GetStats() map[string]map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	stats := make(map[string]map[string]interface{})
	for name := range m.pools {
		cfg, ok := providerConfigs[name]
		if !ok {
			cfg = DefaultProviderConfig(name)
		}
		stats[name] = map[string]interface{}{
			"max_idle_conns":        cfg.MaxIdleConns,
			"max_idle_conns_per_host": cfg.MaxIdleConnsPerHost,
			"max_conns_per_host":    cfg.MaxConnsPerHost,
			"idle_conn_timeout":     cfg.IdleConnTimeout.String(),
			"response_timeout":      cfg.ResponseTimeout.String(),
		}
	}
	return stats
}

// CloseIdleConnections closes idle connections for all pools
func (m *ConnectionPoolManager) CloseIdleConnections() {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	for _, client := range m.pools {
		client.CloseIdleConnections()
	}
}

// GetProviderClient is a convenience function to get a client for a provider
func GetProviderClient(providerName string) *http.Client {
	return GetPoolManager().GetClient(providerName)
}

// GetDefaultClient returns the default HTTP client (for backward compatibility)
func GetDefaultClient() *http.Client {
	return GetPoolManager().GetClient("default")
}

// ProviderNameFromChannelType maps channel type to provider name
func ProviderNameFromChannelType(channelType int) string {
	// These should match the channel types defined in relay/channeltype
	switch channelType {
	case 1: // OpenAI
		return "openai"
	case 3: // Azure
		return "azure"
	case 14: // Anthropic
		return "anthropic"
	case 24: // Gemini
		return "gemini"
	case 15: // Baidu
		return "baidu"
	case 17: // Ali
		return "ali"
	case 18: // Xunfei
		return "xunfei"
	case 23: // Tencent
		return "tencent"
	case 16: // ZhiPu
		return "zhipu"
	case 37: // DeepSeek
		return "deepseek"
	default:
		return "default"
	}
}

// GetClientForChannel returns the appropriate HTTP client for a channel type
func GetClientForChannel(channelType int) *http.Client {
	providerName := ProviderNameFromChannelType(channelType)
	return GetProviderClient(providerName)
}
