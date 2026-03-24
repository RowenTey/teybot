CREATE TABLE IF NOT EXISTS daily_job_runs (
  id TEXT PRIMARY KEY,
  run_date TEXT NOT NULL,
  schedule_id TEXT NOT NULL,
  chat_id INTEGER NOT NULL,
  message_thread_id INTEGER,
  cron_expr TEXT NOT NULL,
  description TEXT NOT NULL,
  task_name TEXT,
  status TEXT NOT NULL,
  was_sent INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL,
  message_text TEXT NOT NULL,
  error TEXT,
  executed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id)
);

CREATE INDEX IF NOT EXISTS idx_daily_job_runs_run_date ON daily_job_runs(run_date);
CREATE INDEX IF NOT EXISTS idx_daily_job_runs_task_name ON daily_job_runs(task_name);
