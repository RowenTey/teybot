package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"slices"

	"github.com/Rowentey/teybot/model"
	"github.com/Rowentey/teybot/util"
	"github.com/go-co-op/gocron/v2"
	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
	"github.com/google/uuid"
	"github.com/robfig/cron/v3"
)

// CronWorker manages scheduled messages
type CronWorker struct {
	scheduler  gocron.Scheduler
	bot        *bot.Bot
	schedules  []model.ScheduledMessage
	configPath string
	jobIDs     map[string]uuid.UUID
	mu         sync.Mutex
}

// NewCronWorker creates a new cron worker
func NewCronWorker(b *bot.Bot, configPath string) *CronWorker {
	// Create a new gocron scheduler
	location, _ := time.LoadLocation("Asia/Singapore")
	scheduler, err := gocron.NewScheduler(gocron.WithLocation(location))
	if err != nil {
		log.Fatalf("Failed to create scheduler: %v", err)
	}

	worker := &CronWorker{
		scheduler:  scheduler,
		bot:        b,
		configPath: configPath,
		jobIDs:     make(map[string]uuid.UUID),
	}

	log.Println("Loading schedules...")
	// Load existing schedules
	if err := worker.LoadConfig(); err != nil {
		log.Printf("Failed to load cron config: %v, starting with empty config", err)
		worker.schedules = []model.ScheduledMessage{}
	}
	log.Println("Loaded schedules!")

	return worker
}

// Start begins the cron scheduler
func (w *CronWorker) Start() {
	w.scheduler.Start()
	log.Println("Cron worker started")

	// Setup all enabled schedules
	for _, schedule := range w.schedules {
		if err := w.ValidateSchedule(schedule); err != nil {
			log.Printf("Invalid schedule found: %v", err)
			continue
		}
		if schedule.Enabled {
			w.addScheduleToRunner(schedule)
		}
	}
}

// Stop halts the cron scheduler
func (w *CronWorker) Stop() {
	w.scheduler.Shutdown()
	log.Println("Cron worker stopped")
}

// SaveConfig writes the current schedules to the config file
func (w *CronWorker) SaveConfig() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	data, err := json.MarshalIndent(w.schedules, "", "  ")
	if err != nil {
		return fmt.Errorf("error marshaling schedules: %w", err)
	}

	return os.WriteFile(w.configPath, data, 0644)
}

// LoadConfig reads schedules from the config file
func (w *CronWorker) LoadConfig() error {
	w.mu.Lock()

	data, err := os.ReadFile(w.configPath)
	if err != nil {
		if os.IsNotExist(err) {
			// Create empty config if not exists
			w.schedules = []model.ScheduledMessage{}

			// Unlock before saving to avoid deadlock
			w.mu.Unlock()
			return w.SaveConfig()
		}
		w.mu.Unlock()
		return err
	}

	w.mu.Unlock()
	return json.Unmarshal(data, &w.schedules)
}

// ValidateSchedule checks if the schedule is valid
func (w *CronWorker) ValidateSchedule(schedule model.ScheduledMessage) error {
	// Validate cron expression
	if _, err := cron.ParseStandard(schedule.CronExpr); err != nil {
		return fmt.Errorf("invalid cron expression")
	}

	// Validate task name if provided
	if schedule.TaskName != "" {
		if _, ok := util.TaskMap[schedule.TaskName]; !ok {
			return fmt.Errorf("invalid task name")
		}
	}

	return nil
}

// AddSchedule adds a new scheduled message
func (w *CronWorker) AddSchedule(schedule model.ScheduledMessage) error {
	w.mu.Lock()

	if err := w.ValidateSchedule(schedule); err != nil {
		w.mu.Unlock()
		return err
	}

	w.schedules = append(w.schedules, schedule)
	if schedule.Enabled {
		w.addScheduleToRunner(schedule)
	}

	// Unlock before saving to avoid deadlock
	w.mu.Unlock()
	return w.SaveConfig()
}

// UpdateSchedule updates an existing schedule
func (w *CronWorker) UpdateSchedule(schedule model.ScheduledMessage) error {
	w.mu.Lock()

	if err := w.ValidateSchedule(schedule); err != nil {
		w.mu.Unlock()
		return err
	}

	// Find and update the schedule
	found := false
	for i, s := range w.schedules {
		if s.ID == schedule.ID {
			// Remove from runner if it exists
			if jobID, exists := w.jobIDs[schedule.ID]; exists {
				err := w.scheduler.RemoveJob(jobID)
				if err != nil {
					log.Printf("Failed to remove job %s: %v\n", jobID, err)
				}
				delete(w.jobIDs, schedule.ID)
			}

			// Update the schedule
			w.schedules[i] = schedule
			found = true

			// If enabled, add back to runner
			if schedule.Enabled {
				w.addScheduleToRunner(schedule)
			}
			break
		}
	}

	if !found {
		w.mu.Unlock()
		return fmt.Errorf("schedule with ID %s not found", schedule.ID)
	}

	// Unlock before saving to avoid deadlock
	w.mu.Unlock()
	return w.SaveConfig()
}

// RemoveSchedule deletes a schedule
func (w *CronWorker) RemoveSchedule(id string) error {
	w.mu.Lock()

	// Find and remove the schedule
	found := false
	for i, s := range w.schedules {
		if s.ID == id {
			// Remove from runner if it exists
			if jobID, exists := w.jobIDs[id]; exists {
				err := w.scheduler.RemoveJob(jobID)
				if err != nil {
					log.Printf("Failed to remove job %s: %v", jobID, err)
				}
				delete(w.jobIDs, id)
			}

			// Remove from schedules slice
			w.schedules = slices.Delete(w.schedules, i, i+1)
			found = true
			break
		}
	}

	if !found {
		w.mu.Unlock()
		return fmt.Errorf("schedule with ID %s not found", id)
	}

	// Unlock before saving to avoid deadlock
	w.mu.Unlock()
	return w.SaveConfig()
}

// GetSchedules returns all configured schedules
func (w *CronWorker) GetSchedules() []model.ScheduledMessage {
	w.mu.Lock()
	defer w.mu.Unlock()

	// Return a copy to avoid race conditions
	schedulesCopy := make([]model.ScheduledMessage, len(w.schedules))
	copy(schedulesCopy, w.schedules)
	return schedulesCopy
}

// Private helper method to add a schedule to the cron runner
func (w *CronWorker) addScheduleToRunner(schedule model.ScheduledMessage) {
	// Create a job that sends the configured message
	task := func() {
		ctx := context.Background()

		// Create message params with common fields
		params := &bot.SendMessageParams{
			ChatID: schedule.ChatID,
			Text:   schedule.Message,
		}

		// Add reply parameters only if MessageThreadID is set
		if schedule.MessageThreadID != 0 {
			params.ReplyParameters = &models.ReplyParameters{
				MessageID: schedule.MessageThreadID,
			}
		}

		// If task name is set, replace the text
		if schedule.TaskName != "" {
			// Invoke the function from TaskMap to get the message text
			params.Text = (util.TaskMap[schedule.TaskName])()
		}

		// Send the message with the constructed params
		_, err := w.bot.SendMessage(ctx, params)
		if err != nil {
			log.Printf("Failed to send scheduled message (ID: %s): %v", schedule.ID, err)
		} else {
			log.Printf("Sent scheduled message: %s", schedule.Description)
		}
	}

	// Create a new job
	job, err := w.scheduler.NewJob(
		gocron.CronJob(schedule.CronExpr, false),
		gocron.NewTask(task),
	)
	if err != nil {
		log.Printf("Failed to create job definition (ID: %s): %v", schedule.ID, err)
		return
	}

	// Store the job ID for potential removal later
	w.jobIDs[schedule.ID] = job.ID()
}
