package model

import (
	"context"
	"sync"
	"time"

	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/helper"
	"github.com/songquanpeng/one-api/common/logger"
)

// LogBatcher handles async batched log insertion
// This decouples logging from the request path, reducing latency by 5-20ms
type LogBatcher struct {
	buffer      []*Log
	bufferSize  int
	maxSize     int
	flushPeriod time.Duration
	mu          sync.Mutex
	done        chan struct{}
	wg          sync.WaitGroup
	started     bool
}

var (
	logBatcher     *LogBatcher
	logBatcherOnce sync.Once
)

// GetLogBatcher returns the singleton log batcher
func GetLogBatcher() *LogBatcher {
	logBatcherOnce.Do(func() {
		logBatcher = NewLogBatcher(1000, 5*time.Second)
	})
	return logBatcher
}

// NewLogBatcher creates a new log batcher
// maxSize: maximum number of logs to buffer before forced flush
// flushPeriod: how often to flush buffered logs
func NewLogBatcher(maxSize int, flushPeriod time.Duration) *LogBatcher {
	if maxSize <= 0 {
		maxSize = 1000
	}
	if flushPeriod <= 0 {
		flushPeriod = 5 * time.Second
	}

	return &LogBatcher{
		buffer:      make([]*Log, 0, maxSize),
		maxSize:     maxSize,
		flushPeriod: flushPeriod,
		done:        make(chan struct{}),
	}
}

// Start starts the background flushing goroutine
func (b *LogBatcher) Start() {
	b.mu.Lock()
	if b.started {
		b.mu.Unlock()
		return
	}
	b.started = true
	b.mu.Unlock()

	b.wg.Add(1)
	go b.flushLoop()

	logger.SysLog("Log batcher started")
}

// Stop stops the batcher and flushes remaining logs
func (b *LogBatcher) Stop() {
	b.mu.Lock()
	if !b.started {
		b.mu.Unlock()
		return
	}
	b.mu.Unlock()

	close(b.done)
	b.wg.Wait()

	// Final flush
	b.flush()

	logger.SysLog("Log batcher stopped")
}

// flushLoop runs the periodic flush
func (b *LogBatcher) flushLoop() {
	defer b.wg.Done()

	ticker := time.NewTicker(b.flushPeriod)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			b.flush()
		case <-b.done:
			return
		}
	}
}

// Add adds a log to the buffer
// If the buffer is full, it triggers an immediate flush
func (b *LogBatcher) Add(log *Log) {
	b.mu.Lock()
	b.buffer = append(b.buffer, log)
	shouldFlush := len(b.buffer) >= b.maxSize
	b.mu.Unlock()

	if shouldFlush {
		go b.flush()
	}
}

// flush writes all buffered logs to the database
func (b *LogBatcher) flush() {
	b.mu.Lock()
	if len(b.buffer) == 0 {
		b.mu.Unlock()
		return
	}

	// Swap buffer
	logs := b.buffer
	b.buffer = make([]*Log, 0, b.maxSize)
	b.mu.Unlock()

	// Batch insert
	start := time.Now()
	err := batchInsertLogs(logs)
	duration := time.Since(start)

	if err != nil {
		logger.SysError("Failed to batch insert logs: " + err.Error())
		// On failure, we could implement retry logic here
		// For now, logs are lost on failure
	} else {
		logger.SysLogf("Batch inserted %d logs in %v", len(logs), duration)
	}
}

// batchInsertLogs inserts multiple logs in a single transaction
func batchInsertLogs(logs []*Log) error {
	if len(logs) == 0 {
		return nil
	}

	// Use transaction for atomicity
	tx := LOG_DB.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	// Batch insert in chunks to avoid huge queries
	chunkSize := 100
	for i := 0; i < len(logs); i += chunkSize {
		end := i + chunkSize
		if end > len(logs) {
			end = len(logs)
		}
		chunk := logs[i:end]

		if err := tx.CreateInBatches(chunk, len(chunk)).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	return tx.Commit().Error
}

// Stats returns current batcher statistics
func (b *LogBatcher) Stats() map[string]interface{} {
	b.mu.Lock()
	defer b.mu.Unlock()

	return map[string]interface{}{
		"buffer_size":   len(b.buffer),
		"max_size":      b.maxSize,
		"flush_period":  b.flushPeriod.String(),
		"started":       b.started,
	}
}

// RecordLogAsync records a log asynchronously using the batcher
// This is the recommended way to record logs in the hot path
func RecordLogAsync(ctx context.Context, userId int, logType int, content string) {
	if logType == LogTypeConsume && !config.LogConsumeEnabled {
		return
	}

	log := &Log{
		UserId:    userId,
		Username:  GetUsernameById(userId),
		CreatedAt: helper.GetTimestamp(),
		Type:      logType,
		Content:   content,
		RequestId: helper.GetRequestID(ctx),
	}

	GetLogBatcher().Add(log)
}

// RecordConsumeLogAsync records a consume log asynchronously
func RecordConsumeLogAsync(ctx context.Context, log *Log) {
	if !config.LogConsumeEnabled {
		return
	}

	log.Username = GetUsernameById(log.UserId)
	log.CreatedAt = helper.GetTimestamp()
	log.Type = LogTypeConsume
	log.RequestId = helper.GetRequestID(ctx)

	GetLogBatcher().Add(log)
}

// InitLogBatcher initializes and starts the log batcher
func InitLogBatcher() {
	if config.BatchUpdateEnabled {
		GetLogBatcher().Start()
	}
}

// StopLogBatcher stops the log batcher gracefully
func StopLogBatcher() {
	GetLogBatcher().Stop()
}

// ConsumeLogEntry represents a pre-prepared consume log entry
// This can be used to prepare log data in the request handler
// and then submit it asynchronously
type ConsumeLogEntry struct {
	UserId            int
	TokenName         string
	ModelName         string
	Quota             int
	PromptTokens      int
	CompletionTokens  int
	ChannelId         int
	ElapsedTime       int64
	IsStream          bool
	SystemPromptReset bool
	Content           string
}

// ToLog converts ConsumeLogEntry to Log
func (e *ConsumeLogEntry) ToLog(ctx context.Context) *Log {
	return &Log{
		UserId:            e.UserId,
		Username:          GetUsernameById(e.UserId),
		CreatedAt:         helper.GetTimestamp(),
		Type:              LogTypeConsume,
		Content:           e.Content,
		TokenName:         e.TokenName,
		ModelName:         e.ModelName,
		Quota:             e.Quota,
		PromptTokens:      e.PromptTokens,
		CompletionTokens:  e.CompletionTokens,
		ChannelId:         e.ChannelId,
		RequestId:         helper.GetRequestID(ctx),
		ElapsedTime:       e.ElapsedTime,
		IsStream:          e.IsStream,
		SystemPromptReset: e.SystemPromptReset,
	}
}

// SubmitAsync submits the log entry asynchronously
func (e *ConsumeLogEntry) SubmitAsync(ctx context.Context) {
	if !config.LogConsumeEnabled {
		return
	}
	GetLogBatcher().Add(e.ToLog(ctx))
}
