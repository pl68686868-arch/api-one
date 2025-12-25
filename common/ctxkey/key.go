package ctxkey

const (
	Config            = "config"
	Id                = "id"
	Username          = "username"
	Role              = "role"
	Status            = "status"
	Channel           = "channel"
	ChannelId         = "channel_id"
	SpecificChannelId = "specific_channel_id"
	RequestModel      = "request_model"
	ConvertedRequest  = "converted_request"
	OriginalModel     = "original_model"
	Group             = "group"
	ModelMapping      = "model_mapping"
	IsStream          = "is_stream"
	PromptTokens      = "prompt_tokens"
	ActualModel       = "actual_model"       // Added for tracking actual model after mapping
	ChannelHealthScore = "channel_health_score" // Added for tracking channel health
	SelectionReason    = "selection_reason"     // Added for tracking selection reasoning
	AvailableChannels  = "available_channels"   // Added for tracking channel count
	SelectionScore     = "selection_score"      // Added for tracking selection score
	ChannelName       = "channel_name"
	TokenId           = "token_id"
	TokenName         = "token_name"
	BaseURL           = "base_url"
	AvailableModels   = "available_models"
	KeyRequestBody    = "key_request_body"
	SystemPrompt      = "system_prompt"
)
