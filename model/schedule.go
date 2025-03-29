package model

// ScheduleRequest is used for creating/updating schedules via API
type ScheduleRequest struct {
	ChatID          int64  `json:"chat_id"`
	MessageThreadID int    `json:"message_thread_id"`
	Message         string `json:"message"`
	CronExpr        string `json:"cron_expr"`
	Description     string `json:"description"`
	Enabled         bool   `json:"enabled"`
	TaskName        string `json:"task_name"`
}

// ScheduledMessage defines a message to be sent on a schedule
type ScheduledMessage struct {
	ID              string `json:"id"`                // Unique identifier
	ChatID          int64  `json:"chat_id"`           // Telegram chat ID
	MessageThreadID int    `json:"message_thread_id"` // Telegram message thread ID
	Message         string `json:"message"`           // Message text
	CronExpr        string `json:"cron_expr"`         // Cron expression (e.g. "0 9 * * *" for 9am daily)
	Description     string `json:"description"`       // Human-readable description
	Enabled         bool   `json:"enabled"`           // Whether this schedule is active
	TaskName        string `json:"task_name"`         // Name of the task to run
}
