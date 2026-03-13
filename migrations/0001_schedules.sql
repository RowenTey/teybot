CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  chat_id INTEGER NOT NULL,
  message_thread_id INTEGER,
  message TEXT NOT NULL,
  cron_expr TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  task_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);
