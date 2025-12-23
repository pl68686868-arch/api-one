package automodel

import (
	"regexp"
	"strings"

	"github.com/songquanpeng/one-api/relay/model"
)

// Pre-compiled regex patterns for language detection (performance optimization)
var (
	// Vietnamese diacritics pattern
	viDiacritics = regexp.MustCompile(`[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]`)
	// Common Vietnamese words
	viWords = regexp.MustCompile(`\b(của|là|và|có|được|trong|cho|với|này|những|đã|để|người|không|một|các|từ|theo|như|khi|tôi|bạn|anh|chị|em)\b`)
	// Chinese characters
	chinesePattern = regexp.MustCompile(`[\x{4e00}-\x{9fff}]`)
	// Japanese hiragana/katakana
	japanesePattern = regexp.MustCompile(`[\x{3040}-\x{309f}\x{30a0}-\x{30ff}]`)
	// Korean hangul
	koreanPattern = regexp.MustCompile(`[\x{ac00}-\x{d7af}]`)
	// CJK pattern for token estimation
	cjkPattern = regexp.MustCompile(`[\x{4e00}-\x{9fff}\x{3040}-\x{30ff}\x{ac00}-\x{d7af}]`)
)

// RequestFeatures contains analyzed features of the request
type RequestFeatures struct {
	Language        string  // detected language: "vi", "en", "zh", etc.
	HasCode         bool    // contains code snippets
	HasVision       bool    // contains images
	TokenCount      int     // estimated token count
	Complexity      float64 // estimated complexity (0-1)
	IsLongContext   bool    // needs long context window
}

// AnalyzeRequest analyzes messages and extracts features
func AnalyzeRequest(messages []model.Message) *RequestFeatures {
	features := &RequestFeatures{
		Language:   "en",
		Complexity: 0.5,
	}

	// Extract all text from messages
	var textBuilder strings.Builder
	for _, msg := range messages {
		content := extractContent(msg)
		textBuilder.WriteString(content)
		textBuilder.WriteString(" ")

		// Check for vision content
		if hasVisionContent(msg) {
			features.HasVision = true
		}

		// Check for code
		if hasCodeContent(content) {
			features.HasCode = true
		}
	}

	text := textBuilder.String()

	// Detect language
	features.Language = detectLanguage(text)

	// Estimate token count (rough: 4 chars per token for English, 2 for CJK)
	features.TokenCount = estimateTokens(text)

	// Check if long context needed
	features.IsLongContext = features.TokenCount > 30000

	// Estimate complexity based on content
	features.Complexity = estimateComplexity(text, features)

	return features
}

// detectLanguage detects the primary language of the text
func detectLanguage(text string) string {
	// Vietnamese detection (highest priority for auto-vi)
	if viDiacritics.MatchString(text) {
		return "vi"
	}
	if viWords.MatchString(strings.ToLower(text)) {
		return "vi"
	}

	// Chinese detection (use pre-compiled pattern)
	if chinesePattern.MatchString(text) {
		return "zh"
	}

	// Japanese detection (use pre-compiled pattern)
	if japanesePattern.MatchString(text) {
		return "ja"
	}

	// Korean detection (use pre-compiled pattern)
	if koreanPattern.MatchString(text) {
		return "ko"
	}

	return "en"
}

// extractContent extracts text content from a message
func extractContent(msg model.Message) string {
	if msg.Content == nil {
		return ""
	}

	// Handle string content
	if str, ok := msg.Content.(string); ok {
		return str
	}

	// Handle array content (multimodal)
	if arr, ok := msg.Content.([]interface{}); ok {
		var parts []string
		for _, item := range arr {
			if m, ok := item.(map[string]interface{}); ok {
				if text, ok := m["text"].(string); ok {
					parts = append(parts, text)
				}
			}
		}
		return strings.Join(parts, " ")
	}

	return ""
}

// hasVisionContent checks if message contains image content
func hasVisionContent(msg model.Message) bool {
	if arr, ok := msg.Content.([]interface{}); ok {
		for _, item := range arr {
			if m, ok := item.(map[string]interface{}); ok {
				if itemType, ok := m["type"].(string); ok && itemType == "image_url" {
					return true
				}
			}
		}
	}
	return false
}

// hasCodeContent checks if text contains code patterns
func hasCodeContent(text string) bool {
	codePatterns := []string{
		"```",
		"def ",
		"func ",
		"function ",
		"class ",
		"import ",
		"const ",
		"let ",
		"var ",
		"public ",
		"private ",
		"package ",
	}

	lower := strings.ToLower(text)
	for _, pattern := range codePatterns {
		if strings.Contains(lower, pattern) {
			return true
		}
	}
	return false
}

// estimateTokens estimates token count from text
func estimateTokens(text string) int {
	// Rough estimation: ~4 chars per token for English
	// ~2 chars per token for CJK languages
	charCount := len(text)

	// Check for CJK characters (use pre-compiled pattern)
	cjkMatches := cjkPattern.FindAllString(text, -1)

	if len(cjkMatches) > charCount/4 {
		// Mostly CJK
		return charCount / 2
	}

	return charCount / 4
}

// estimateComplexity estimates request complexity
func estimateComplexity(text string, features *RequestFeatures) float64 {
	complexity := 0.5

	// Code increases complexity
	if features.HasCode {
		complexity += 0.2
	}

	// Vision increases complexity
	if features.HasVision {
		complexity += 0.2
	}

	// Long context increases complexity
	if features.IsLongContext {
		complexity += 0.1
	}

	// Very long text increases complexity
	if features.TokenCount > 10000 {
		complexity += 0.1
	}

	if complexity > 1.0 {
		complexity = 1.0
	}

	return complexity
}
