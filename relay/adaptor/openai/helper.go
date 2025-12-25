package openai

import (
	"fmt"
	"strings"

	"github.com/songquanpeng/one-api/relay/channeltype"
	"github.com/songquanpeng/one-api/relay/model"
)

func ResponseText2Usage(responseText string, modelName string, promptTokens int) *model.Usage {
	usage := &model.Usage{}
	usage.PromptTokens = promptTokens
	usage.CompletionTokens = CountTokenText(responseText, modelName)
	usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	return usage
}

func GetFullRequestURL(baseURL string, requestURL string, channelType int) string {
	// OpenAI-compatible providers that use /v1 in their base URL
	// Trim /v1 from requestURL to prevent /v1/v1 duplication
	if channelType == channeltype.OpenAICompatible ||
		channelType == channeltype.Groq ||
		channelType == channeltype.OpenRouter ||
		channelType == channeltype.TogetherAI ||
		channelType == channeltype.Moonshot ||
		channelType == channeltype.DeepSeek {
		return fmt.Sprintf("%s%s", strings.TrimSuffix(baseURL, "/"), strings.TrimPrefix(requestURL, "/v1"))
	}
	fullRequestURL := fmt.Sprintf("%s%s", baseURL, requestURL)

	if strings.HasPrefix(baseURL, "https://gateway.ai.cloudflare.com") {
		switch channelType {
		case channeltype.OpenAI:
			fullRequestURL = fmt.Sprintf("%s%s", baseURL, strings.TrimPrefix(requestURL, "/v1"))
		case channeltype.Azure:
			fullRequestURL = fmt.Sprintf("%s%s", baseURL, strings.TrimPrefix(requestURL, "/openai/deployments"))
		}
	}
	return fullRequestURL
}
