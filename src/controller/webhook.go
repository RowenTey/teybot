package controller

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/Rowentey/teybot/src/model"
	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
)

func WebhookHandler(w http.ResponseWriter, r *http.Request, b *bot.Bot) {
	// Only allow POST requests
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("Failed to read request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	const maxLog = 1024
	if len(body) > maxLog {
		log.Printf("Debug body (truncated %d bytes): %s...", len(body), string(body[:maxLog]))
	} else {
		log.Printf("Debug body: %s", string(body))
	}

	var msgReq model.MessageRequest
	if err := json.Unmarshal(body, &msgReq); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if msgReq.ChatID == 0 || msgReq.Text == "" {
		http.Error(w, "Missing required fields: chat_id or text", http.StatusBadRequest)
		return
	}

	params := &bot.SendMessageParams{
		ChatID: msgReq.ChatID,
		Text:   msgReq.Text,
	}

	if msgReq.MessageThreadID != 0 {
		params.ReplyParameters = &models.ReplyParameters{
			MessageID: msgReq.MessageThreadID,
		}
	}

	// Send message using the bot
	if _, err := b.SendMessage(r.Context(), params); err != nil {
		log.Printf("Error sending message: %v", err)
		http.Error(w, "Failed to send message", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
