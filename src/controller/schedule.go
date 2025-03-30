package controller

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/Rowentey/teybot/src/model"
	"github.com/Rowentey/teybot/src/worker"
	"github.com/google/uuid"
)

// registerCronHandlers sets up the HTTP handlers for managing schedules
func RegisterCronHandlers(cronWorker *worker.CronWorker) {
	// Get all schedules
	http.HandleFunc("/schedules", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			// Return all schedules
			schedules := cronWorker.GetSchedules()
			respondJSON(w, schedules)

		case http.MethodPost:
			// Create a new schedule
			var req model.ScheduleRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				respondError(w, "Invalid request body", http.StatusBadRequest)
				return
			}

			schedule := model.ScheduledMessage{
				ID:              uuid.New().String(),
				ChatID:          req.ChatID,
				MessageThreadID: req.MessageThreadID,
				Message:         req.Message,
				CronExpr:        req.CronExpr,
				Description:     req.Description,
				Enabled:         req.Enabled,
				TaskName:        req.TaskName,
			}
			log.Printf("Creating schedule: %+v", schedule)

			if err := cronWorker.AddSchedule(schedule); err != nil {
				respondError(w, "Failed to create schedule: "+err.Error(), http.StatusBadRequest)
				return
			}

			respondJSON(w, map[string]interface{}{
				"status":  "success",
				"message": "Schedule created",
				"id":      schedule.ID,
			})

		default:
			respondError(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Manage individual schedules
	http.HandleFunc("/schedules/", func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Path[len("/schedules/"):]
		if id == "" {
			respondError(w, "Schedule ID required", http.StatusBadRequest)
			return
		}

		switch r.Method {
		case http.MethodGet:
			// Get a specific schedule
			schedules := cronWorker.GetSchedules()
			for _, s := range schedules {
				if s.ID == id {
					respondJSON(w, s)
					return
				}
			}
			respondError(w, "Schedule not found", http.StatusNotFound)

		case http.MethodPut:
			// Update a schedule
			var req model.ScheduleRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				respondError(w, "Invalid request body", http.StatusBadRequest)
				return
			}

			schedule := model.ScheduledMessage{
				ID:              id,
				ChatID:          req.ChatID,
				MessageThreadID: req.MessageThreadID,
				Message:         req.Message,
				CronExpr:        req.CronExpr,
				Description:     req.Description,
				Enabled:         req.Enabled,
				TaskName:        req.TaskName,
			}

			if err := cronWorker.UpdateSchedule(schedule); err != nil {
				respondError(w, "Failed to update schedule: "+err.Error(), http.StatusBadRequest)
				return
			}

			respondJSON(w, map[string]string{"status": "success", "message": "Schedule updated"})

		case http.MethodDelete:
			// Delete a schedule
			if err := cronWorker.RemoveSchedule(id); err != nil {
				respondError(w, "Failed to delete schedule: "+err.Error(), http.StatusBadRequest)
				return
			}

			respondJSON(w, map[string]string{"status": "success", "message": "Schedule deleted"})

		default:
			respondError(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
}

// Helper functions for HTTP responses
func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("Error encoding JSON response: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}
}

func respondError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(map[string]string{"error": message}); err != nil {
		log.Printf("Error encoding JSON error response: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}
}
