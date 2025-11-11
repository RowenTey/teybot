package controller

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/Rowentey/teybot/src/model"
	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
)

func WebhookHandler(w http.ResponseWriter, r *http.Request, b *bot.Bot) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var msgReq model.MessageRequest
	if err := json.NewDecoder(r.Body).Decode(&msgReq); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if msgReq.ChatID == 0 {
		http.Error(w, "Missing required field: chat_id", http.StatusBadRequest)
		return
	}
	if msgReq.Title == "" {
		http.Error(w, "Missing required field: title", http.StatusBadRequest)
		return
	}
	if msgReq.Message == "" {
		http.Error(w, "Missing required field: message", http.StatusBadRequest)
		return
	}

	text := fmt.Sprintf(
		"*%s*\n\n%s",
		escapeMarkdownV2(msgReq.Title),
		escapeMarkdownV2(msgReq.Message),
	)

	params := &bot.SendMessageParams{
		ChatID:    msgReq.ChatID,
		Text:      text,
		ParseMode: models.ParseModeMarkdown,
	}
	if msgReq.MessageThreadID != 0 {
		params.ReplyParameters = &models.ReplyParameters{
			MessageID: msgReq.MessageThreadID,
		}
	}

	if _, err := b.SendMessage(r.Context(), params); err != nil {
		log.Printf("Error sending message: %v", err)
		http.Error(w, "Failed to send message", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// escapeMarkdownV2 safely escapes special characters for Telegram MarkdownV2
func escapeMarkdownV2(s string) string {
	specialChars := []string{"_", "*", "[", "]", "(", ")", "~", "`", ">", "#", "+", "-", "=", "|", "{", "}", ".", "!"}
	for _, ch := range specialChars {
		s = strings.ReplaceAll(s, ch, "\\"+ch)
	}
	return s
}
