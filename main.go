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
	port        = "8080"
	swaggerFile = "swagger.yaml"
)

func main() {
	// Setup context with interrupt handling
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	if err := loadEnv(); err != nil {
		log.Fatalf("Failed to load environment variables: %v", err)
	}

	botClient, err := initBot()
	if err != nil {
		log.Fatalf("Failed to initialize bot: %v", err)
	}

	cronWorker := worker.NewCronWorker(botClient, "cron_config.json")
	startCronWorker(cronWorker)
	defer cronWorker.Stop()

	srv := setupHTTPServer(botClient, cronWorker)

	if err := startServices(ctx, srv, botClient); err != nil {
		log.Fatalf("Service startup failed: %v", err)
	}

	waitForShutdown(ctx, srv)
	log.Println("Shutdown complete")
}

// loadEnv loads .env file only in dev mode
func loadEnv() error {
	if len(os.Args) > 1 && os.Args[1] == "dev" {
		log.Println("Loading .env file...")
		return godotenv.Load()
	}
	return nil
}

// initBot creates and configures the Telegram bot
func initBot() (*bot.Bot, error) {
	opts := []bot.Option{
		bot.WithDefaultHandler(controller.Handler),
		bot.WithCheckInitTimeout(10 * time.Second),
	}

	b, err := bot.New(os.Getenv("BOT_TOKEN"), opts...)
	if err != nil {
		return nil, fmt.Errorf("bot initialization failed: %w", err)
	}

	b.RegisterHandler(bot.HandlerTypeMessageText, "/start", bot.MatchTypeExact, controller.StartHandler)

	log.Println("Bot initialized")
	return b, nil
}

// startCronWorker starts the cron worker in a goroutine
func startCronWorker(cronWorker *worker.CronWorker) {
	go func() {
		log.Println("Starting cron worker...")
		cronWorker.Start()
	}()
}

// setupHTTPServer configures all HTTP routes and returns the server
func setupHTTPServer(b *bot.Bot, cronWorker *worker.CronWorker) *http.Server {
	mux := http.NewServeMux()

	mux.HandleFunc("/webhook", func(w http.ResponseWriter, r *http.Request) {
		controller.WebhookHandler(w, r, b)
	})

	mux.HandleFunc(fmt.Sprintf("GET /%s", swaggerFile), func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./docs/openapi.yaml")
	})
	mux.HandleFunc("GET /docs/", httpSwagger.Handler(
		httpSwagger.URL(fmt.Sprintf("/%s", swaggerFile)),
	))

	controller.RegisterCronHandlers(cronWorker)

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	return srv
}

// startServices runs HTTP server and Telegram bot concurrently
func startServices(ctx context.Context, srv *http.Server, b *bot.Bot) error {
	errChan := make(chan error, 2)

	// Start HTTP server
	go func() {
		log.Printf("Starting HTTP server on :%s\n", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errChan <- fmt.Errorf("http server error: %w", err)
		}
	}()

	// Start Telegram bot
	go func() {
		log.Println("Starting Telegram bot...")
		b.Start(ctx)
	}()

	// Wait for either context cancellation or error
	select {
	case <-ctx.Done():
		log.Println("Received shutdown signal")
	case err := <-errChan:
		return err
	}

	return nil
}

// waitForShutdown performs graceful shutdown
func waitForShutdown(ctx context.Context, srv *http.Server) {
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP server forced to shutdown: %v", err)
	} else {
		log.Println("HTTP server stopped gracefully")
	}

	<-shutdownCtx.Done()
	if shutdownCtx.Err() == context.DeadlineExceeded {
		log.Println("Shutdown timeout exceeded")
	}
}
