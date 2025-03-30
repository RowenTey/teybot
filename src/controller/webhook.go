package controller

import (
	"encoding/json"
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

	// Parse JSON request
	var msgReq model.MessageRequest
	if err := json.NewDecoder(r.Body).Decode(&msgReq); err != nil {
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
	_, err := b.SendMessage(r.Context(), params)
	if err != nil {
		log.Printf("Error sending message: %v", err)
		http.Error(w, "Failed to send message", http.StatusInternalServerError)
		return
	}

	// Response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}
