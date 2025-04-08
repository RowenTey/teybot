package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/Rowentey/teybot/src/controller"
	"github.com/Rowentey/teybot/src/worker"
	"github.com/go-telegram/bot"
	"github.com/joho/godotenv"
	httpSwagger "github.com/swaggo/http-swagger"
)

const (
	PORT        = "8080"
	SWAGGER_URL = "swagger.yaml"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancel()

	// Environment setup
	env := ""
	if len(os.Args) > 1 {
		env = os.Args[1]
	}
	if env == "dev" {
		log.Println("Loading .env file...")
		if err := godotenv.Load(".env"); err != nil {
			log.Fatal("Error loading .env file")
		}
	}

	// Initialize bot
	opts := []bot.Option{
		bot.WithDefaultHandler(controller.Handler),
		bot.WithCheckInitTimeout(10 * time.Second),
	}
	b, err := bot.New(os.Getenv("BOT_TOKEN"), opts...)
	if err != nil {
		panic(err)
	}
	log.Println("Bot created")

	// Initialize cron worker with context
	log.Println("Creating cron worker")
	cronWorker := worker.NewCronWorker(b, "cron_config.json")
	go cronWorker.Start()
	defer cronWorker.Stop()

	// Register handlers
	http.HandleFunc("/webhook", func(w http.ResponseWriter, r *http.Request) {
		controller.WebhookHandler(w, r, b)
	})
	controller.RegisterCronHandlers(cronWorker)

	// Swagger setup
	http.HandleFunc(fmt.Sprintf("GET /%s", SWAGGER_URL), func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./docs/openapi.yaml")
	})
	http.HandleFunc("GET /docs/", httpSwagger.Handler(
		httpSwagger.URL(fmt.Sprintf("/%s", SWAGGER_URL)),
	))

	// Telegram handlers
	b.RegisterHandler(bot.HandlerTypeMessageText, "/start", bot.MatchTypeExact, controller.StartHandler)

	// Create HTTP server
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", PORT),
		Handler: nil,
	}

	// Start HTTP server in goroutine
	serverErr := make(chan error, 1)
	go func() {
		log.Printf("Starting HTTP server on :%s...\n", PORT)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErr <- err
		}
	}()

	// Start bot in goroutine
	go func() {
		log.Println("Bot starting...")
		b.Start(ctx)
	}()

	// Wait for either:
	// 1. An interrupt signal (ctx.Done())
	// 2. An error from the server or bot
	select {
	case <-ctx.Done():
		log.Println("Received interrupt signal, shutting down...")
	case err := <-serverErr:
		log.Printf("HTTP server error: %v\n", err)
		// Trigger shutdown of other components
		cancel()
	}

	// Graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	// Shutdown HTTP server
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP server shutdown error: %v", err)
	}

	// Bot will stop automatically when its context is cancelled
	// Cron worker will stop via defer
	log.Println("Shutdown complete")
}
