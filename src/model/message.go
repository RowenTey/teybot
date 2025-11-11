package model

// MessageRequest represents the expected payload for the webhook
type MessageRequest struct {
	ChatID          int64  `json:"chat_id"`
	MessageThreadID int    `json:"message_thread_id,omitempty"`
	Title           string `json:"title"`
	Message         string `json:"message"`
}
