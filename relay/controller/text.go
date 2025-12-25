package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/songquanpeng/one-api/common/config"
	"github.com/songquanpeng/one-api/common/logger"
	"github.com/songquanpeng/one-api/relay"
	"github.com/songquanpeng/one-api/relay/adaptor"
	"github.com/songquanpeng/one-api/relay/adaptor/openai"
	"github.com/songquanpeng/one-api/relay/apitype"
	"github.com/songquanpeng/one-api/relay/billing"
	billingratio "github.com/songquanpeng/one-api/relay/billing/ratio"
	"github.com/songquanpeng/one-api/relay/cache"
	"github.com/songquanpeng/one-api/relay/channeltype"
	"github.com/songquanpeng/one-api/relay/meta"
	"github.com/songquanpeng/one-api/relay/model"
)

func RelayTextHelper(c *gin.Context) *model.ErrorWithStatusCode {
	ctx := c.Request.Context()
	meta := meta.GetByContext(c)
	// get & validate textRequest
	textRequest, err := getAndValidateTextRequest(c, meta.Mode)
	if err != nil {
		logger.Errorf(ctx, "getAndValidateTextRequest failed: %s", err.Error())
		return openai.ErrorWrapper(err, "invalid_text_request", http.StatusBadRequest)
	}
	meta.IsStream = textRequest.Stream

	// Check cache before LLM call
	if config.ResponseCacheEnabled {
		if cached, found := cache.GetCache().CheckCache(meta.OriginModelName, textRequest.Messages); found {
			logger.Infof(ctx, "[CACHE HIT] model=%s stream=%v", meta.OriginModelName, meta.IsStream)
			
			if meta.IsStream {
				// Replay cached stream
				if err := cache.ReplayCachedStream(c, cached); err != nil {
					logger.SysError("Failed to replay cached stream: " + err.Error())
					cache.CacheMetrics.RecordMiss()
				} else {
					return nil // Success - cached stream sent
				}
			} else {
				// Return cached non-streaming response
				content := cache.ExtractContentFromStream(cached)
				c.JSON(http.StatusOK, gin.H{
					"id":      "chatcmpl-cached",
					"object":  "chat.completion",
					"created": 1234567890,
					"model":   meta.OriginModelName,
					"choices": []gin.H{{
						"index": 0,
						"message": gin.H{
							"role":    "assistant",
							"content": content,
						},
						"finish_reason": "stop",
					}},
				})
				return nil // Success - cached response sent
			}
		}
		cache.CacheMetrics.RecordMiss()
	}

	// map model name
	meta.OriginModelName = textRequest.Model
	textRequest.Model, _ = getMappedModelName(textRequest.Model, meta.ModelMapping)
	meta.ActualModelName = textRequest.Model
	// set system prompt if not empty
	systemPromptReset := setSystemPrompt(ctx, textRequest, meta.ForcedSystemPrompt)
	// get model ratio & group ratio
	modelRatio := billingratio.GetModelRatio(textRequest.Model, meta.ChannelType)
	groupRatio := billingratio.GetGroupRatio(meta.Group)
	ratio := modelRatio * groupRatio
	// pre-consume quota
	promptTokens := getPromptTokens(textRequest, meta.Mode)
	meta.PromptTokens = promptTokens
	preConsumedQuota, bizErr := preConsumeQuota(ctx, textRequest, promptTokens, ratio, meta)
	if bizErr != nil {
		logger.Warnf(ctx, "preConsumeQuota failed: %+v", *bizErr)
		return bizErr
	}

	adaptor := relay.GetAdaptor(meta.APIType)
	if adaptor == nil {
		return openai.ErrorWrapper(fmt.Errorf("invalid api type: %d", meta.APIType), "invalid_api_type", http.StatusBadRequest)
	}
	adaptor.Init(meta)

	// get request body
	requestBody, err := getRequestBody(c, meta, textRequest, adaptor)
	if err != nil {
		return openai.ErrorWrapper(err, "convert_request_failed", http.StatusInternalServerError)
	}

	// do request
	resp, err := adaptor.DoRequest(c, meta, requestBody)
	if err != nil {
		logger.Errorf(ctx, "DoRequest failed: %s", err.Error())
		return openai.ErrorWrapper(err, "do_request_failed", http.StatusInternalServerError)
	}
	if isErrorHappened(meta, resp) {
		billing.ReturnPreConsumedQuota(ctx, preConsumedQuota, meta.TokenId)
		return RelayErrorHandler(resp)
	}

	// do response with caching support
	var usage *model.Usage
	var respErr *model.ErrorWithStatusCode
	
	if config.ResponseCacheEnabled && meta.IsStream {
		// Capture streaming response for caching
		cachedStream, tokens, err := cache.CaptureAndCacheStream(c, resp, meta.ActualModelName, textRequest.Messages)
		if err != nil {
			logger.Errorf(ctx, "Failed to capture stream: %s", err.Error())
			billing.ReturnPreConsumedQuota(ctx, preConsumedQuota, meta.TokenId)
			return openai.ErrorWrapper(err, "stream_capture_failed", http.StatusInternalServerError)
		}
		
		// Create usage from captured data
		usage = &model.Usage{
			TotalTokens: tokens,
		}
		
		logger.Infof(ctx, "[CACHE STORE] model=%s stream=true cached=%d bytes", meta.ActualModelName, len(cachedStream))
	} else {
		// Normal non-streaming response
		usage, respErr = adaptor.DoResponse(c, resp, meta)
		if respErr != nil {
			logger.Errorf(ctx, "respErr is not nil: %+v", respErr)
			billing.ReturnPreConsumedQuota(ctx, preConsumedQuota, meta.TokenId)
			return respErr
		}
		
		// Cache non-streaming response
		if config.ResponseCacheEnabled && usage != nil {
			// Note: We need response text but DoResponse doesn't return it
			// For non-streaming, we'll cache the next request's response
			// This is a limitation - streaming cache is more effective
		}
	}
	
	// post-consume quota
	go postConsumeQuota(ctx, usage, meta, textRequest, ratio, preConsumedQuota, modelRatio, groupRatio, systemPromptReset)
	return nil
}

func getRequestBody(c *gin.Context, meta *meta.Meta, textRequest *model.GeneralOpenAIRequest, adaptor adaptor.Adaptor) (io.Reader, error) {
	if !config.EnforceIncludeUsage &&
		meta.APIType == apitype.OpenAI &&
		meta.OriginModelName == meta.ActualModelName &&
		meta.ChannelType != channeltype.Baichuan &&
		meta.ForcedSystemPrompt == "" {
		// no need to convert request for openai
		return c.Request.Body, nil
	}

	// get request body
	var requestBody io.Reader
	convertedRequest, err := adaptor.ConvertRequest(c, meta.Mode, textRequest)
	if err != nil {
		logger.Debugf(c.Request.Context(), "converted request failed: %s\n", err.Error())
		return nil, err
	}
	jsonData, err := json.Marshal(convertedRequest)
	if err != nil {
		logger.Debugf(c.Request.Context(), "converted request json_marshal_failed: %s\n", err.Error())
		return nil, err
	}
	logger.Debugf(c.Request.Context(), "converted request: \n%s", string(jsonData))
	requestBody = bytes.NewBuffer(jsonData)
	return requestBody, nil
}
