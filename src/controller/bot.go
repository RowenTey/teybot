package controller

import (
	"context"
	"fmt"
	"log"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
)

func StartHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: update.Message.Chat.ID,
		Text: fmt.Sprintf(
			"Hello, %s! I am Tey's Personal Bot, please contact @Kai_Seong for further enquiries.", update.Message.From.Username),
	})
}

func Handler(ctx context.Context, b *bot.Bot, update *models.Update) {
	log.Printf("Update: %+v\n", update)

	if update.Message == nil {
		return
	}

	log.Printf("Message: %+v\n", update.Message)
	log.Printf("%s [ID %d] said %s\n", update.Message.From.Username, update.Message.Chat.ID, update.Message.Text)

	params := &bot.SendMessageParams{
		ChatID: update.Message.Chat.ID,
		Text:   update.Message.Text,
	}

	if update.Message.MessageThreadID != 0 {
		params.ReplyParameters = &models.ReplyParameters{
			MessageID: update.Message.MessageThreadID,
		}
	}

	b.SendMessage(ctx, params)
}
