package controller

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/common/logger"
	"github.com/songquanpeng/one-api/relay/meta"
	"github.com/songquanpeng/one-api/relay/model"
	"github.com/songquanpeng/one-api/relay/relaymode"
)

type ResponsesRequest struct {
	Model     string          `json:"model,omitempty"`
	Input     []model.Message `json:"input,omitempty"`
	Tools     []interface{}   `json:"tools,omitempty"`
	Stream    bool            `json:"stream,omitempty"`
	MaxTokens int             `json:"max_tokens,omitempty"`
}

func RelayResponsesHelper(c *gin.Context, relayMode int) *model.ErrorWithStatusCode {
	// 1. Read and parse the request body
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return &model.ErrorWithStatusCode{
			StatusCode: http.StatusBadRequest,
			Error: model.Error{
				Message: "failed to read request body",
				Type:    "invalid_request_error",
			},
		}
	}

	var responsesReq ResponsesRequest
	err = json.Unmarshal(bodyBytes, &responsesReq)
	if err != nil {
		logger.Errorf(c.Request.Context(), "unmarshal responses request failed: %s", err.Error())
		return &model.ErrorWithStatusCode{
			StatusCode: http.StatusBadRequest,
			Error: model.Error{
				Message: "invalid json body",
				Type:    "invalid_request_error",
			},
		}
	}

	// 2. Map to GeneralOpenAIRequest (Chat Completions)
	chatReq := model.GeneralOpenAIRequest{
		Model:     responsesReq.Model,
		Messages:  responsesReq.Input,
		Stream:    responsesReq.Stream,
		MaxTokens: responsesReq.MaxTokens,
		// Map other fields as needed, tools might need special handling if structure differs
		// For now simple mapping
	}

	// 3. Serialize back to JSON
	newBodyBytes, err := json.Marshal(chatReq)
	if err != nil {
		return &model.ErrorWithStatusCode{
			StatusCode: http.StatusInternalServerError,
			Error: model.Error{
				Message: "failed to marshal converted request",
				Type:    "one_api_error",
			},
		}
	}

	// 4. Update Context
	c.Request.Body = io.NopCloser(bytes.NewBuffer(newBodyBytes))

	// Update Meta info to pretend it is a ChatCompletion
	requestMeta := meta.GetByContext(c)
	requestMeta.Mode = relaymode.ChatCompletions

	// 5. Forward to RelayTextHelper
	return RelayTextHelper(c)
}
