export interface Env {
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_WEBHOOK_SECRET?: string;
	EXCHANGE_RATE_API_KEY?: string;
	FINNHUB_API_KEY?: string;
	SCHEDULE_TIMEZONE?: string;
	SCHEDULE_DB: D1Database;
}

export interface ScheduleRequest {
	chat_id: number;
	message_thread_id?: number;
	message?: string;
	cron_expr: string;
	description: string;
	enabled: boolean;
	task_name?: string;
}

export interface ScheduledMessage extends ScheduleRequest {
	id: string;
	message: string;
}
