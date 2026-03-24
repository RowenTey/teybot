import type { Env, ScheduledMessage } from "../types";
import { cronMatchesNow, getEnabledSchedules } from "./schedules";
import { getBotAndHandler } from "../telegram";
import { TaskMap, type TaskResult } from "./tasks";

async function resolveMessage(
	schedule: ScheduledMessage,
	env: Env,
): Promise<TaskResult> {
	if (schedule.task_name && TaskMap[schedule.task_name]) {
		return TaskMap[schedule.task_name](env);
	}
	return {
		text: schedule.message,
		summary: "Static message",
		shouldSend: true,
	};
}

function toLocalDate(date: Date, timeZone: string): string {
	const dtf = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});

	return dtf.format(date);
}

async function recordRunOutcome(
	env: Env,
	params: {
		runDate: string;
		schedule: ScheduledMessage;
		status: string;
		wasSent: boolean;
		summary: string;
		messageText: string;
		error: string | null;
	},
): Promise<void> {
	await env.SCHEDULE_DB.prepare(
		"INSERT INTO daily_job_runs (id, run_date, schedule_id, chat_id, message_thread_id, cron_expr, description, task_name, status, was_sent, summary, message_text, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(
			crypto.randomUUID(),
			params.runDate,
			params.schedule.id,
			params.schedule.chat_id,
			params.schedule.message_thread_id ?? null,
			params.schedule.cron_expr,
			params.schedule.description,
			params.schedule.task_name ?? null,
			params.status,
			params.wasSent ? 1 : 0,
			params.summary,
			params.messageText,
			params.error,
		)
		.run();
}

export async function runScheduledDispatch(env: Env, now: Date): Promise<void> {
	const timezone = env.SCHEDULE_TIMEZONE || "Asia/Kuala_Lumpur";
	const runDate = toLocalDate(now, timezone);
	const schedules = await getEnabledSchedules(env);
	const { bot } = getBotAndHandler(env);
	console.log(
		`[scheduler] Checking ${schedules.length} schedules for ${now.toISOString()} in timezone ${timezone}`,
	);

	for (const schedule of schedules) {
		if (!cronMatchesNow(schedule.cron_expr, now, timezone)) {
			continue;
		}

		let status = "skipped";
		let wasSent = false;
		let summary = "No message generated";
		let messageText = "";
		let errorMessage: string | null = null;

		try {
			const result = await resolveMessage(schedule, env);
			messageText = result.text;
			summary = result.summary;

			if (!result.text.trim()) {
				status = "skipped_empty";
			} else if (result.shouldSend === false) {
				status = "skipped_rule";
			} else {
				await bot.api.sendMessage(schedule.chat_id, result.text, {
					message_thread_id: schedule.message_thread_id,
				});
				status = "sent";
				wasSent = true;
			}
		} catch (error) {
			status = "error";
			errorMessage = String(error);
			summary = `Failed: ${String(error)}`;
			console.error("[scheduler] Failed to send scheduled message", {
				schedule_id: schedule.id,
				error,
			});
		} finally {
			try {
				await recordRunOutcome(env, {
					runDate,
					schedule,
					status,
					wasSent,
					summary,
					messageText,
					error: errorMessage,
				});
			} catch (recordError) {
				console.error("[scheduler] Failed to record run outcome", {
					schedule_id: schedule.id,
					recordError,
				});
			}
		}
	}
}
