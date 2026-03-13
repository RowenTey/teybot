import type { Env, ScheduledMessage } from "../types";
import { cronMatchesNow, getEnabledSchedules } from "./schedules";
import { getBotAndHandler } from "../telegram";
import { TaskMap } from "./tasks";

async function resolveMessage(
	schedule: ScheduledMessage,
	env: Env,
): Promise<string> {
	if (schedule.task_name && TaskMap[schedule.task_name]) {
		return TaskMap[schedule.task_name](env);
	}
	return schedule.message;
}

export async function runScheduledDispatch(env: Env, now: Date): Promise<void> {
	const timezone = env.SCHEDULE_TIMEZONE || "Asia/Kuala_Lumpur";
	const schedules = await getEnabledSchedules(env);
	const { bot } = getBotAndHandler(env);
	console.log(
		`[schedule] checking ${schedules.length} schedules for ${now.toISOString()} in timezone ${timezone}`,
	);

	for (const schedule of schedules) {
		if (!cronMatchesNow(schedule.cron_expr, now, timezone)) {
			continue;
		}

		try {
			const text = await resolveMessage(schedule, env);
			if (!text) {
				continue;
			}

			await bot.api.sendMessage(schedule.chat_id, text, {
				message_thread_id: schedule.message_thread_id,
			});
		} catch (error) {
			console.error("[schedule] failed", {
				schedule_id: schedule.id,
				error,
			});
		}
	}
}
