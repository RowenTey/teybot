import type { Env, ScheduledMessage, ScheduleRequest } from "../types";
import { TaskMap } from "./tasks";

const DOW_MAP: Record<string, number> = {
	Sun: 0,
	Mon: 1,
	Tue: 2,
	Wed: 3,
	Thu: 4,
	Fri: 5,
	Sat: 6,
};

function toLocalParts(
	date: Date,
	timeZone: string,
): {
	minute: number;
	hour: number;
	day: number;
	month: number;
	dayOfWeek: number;
} {
	const dtf = new Intl.DateTimeFormat("en-US", {
		timeZone,
		minute: "2-digit",
		hour: "2-digit",
		day: "2-digit",
		month: "2-digit",
		weekday: "short",
		hourCycle: "h23",
	});
	const parts = dtf.formatToParts(date);

	const getPart = (type: string): string =>
		parts.find((p) => p.type === type)?.value ?? "0";

	const weekday = getPart("weekday");
	return {
		minute: Number.parseInt(getPart("minute"), 10),
		hour: Number.parseInt(getPart("hour"), 10),
		day: Number.parseInt(getPart("day"), 10),
		month: Number.parseInt(getPart("month"), 10),
		dayOfWeek: DOW_MAP[weekday] ?? 0,
	};
}

function validateToken(token: string, min: number, max: number): boolean {
	if (token === "*") {
		return true;
	}

	const stepParts = token.split("/");
	if (stepParts.length > 2) {
		return false;
	}

	const base = stepParts[0];
	const step = stepParts[1] ? Number.parseInt(stepParts[1], 10) : null;
	if (step !== null && (!Number.isInteger(step) || step <= 0)) {
		return false;
	}

	if (base === "*") {
		return true;
	}

	const rangeParts = base.split("-");
	if (rangeParts.length === 1) {
		const num = Number.parseInt(rangeParts[0], 10);
		return Number.isInteger(num) && num >= min && num <= max;
	}

	if (rangeParts.length === 2) {
		const start = Number.parseInt(rangeParts[0], 10);
		const end = Number.parseInt(rangeParts[1], 10);
		return (
			Number.isInteger(start) &&
			Number.isInteger(end) &&
			start >= min &&
			end <= max &&
			start <= end
		);
	}

	return false;
}

function fieldMatches(
	field: string,
	value: number,
	min: number,
	max: number,
	isDow = false,
): boolean {
	const normalizedValue = isDow && value === 0 ? 7 : value;
	const tokens = field
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);

	for (const rawToken of tokens) {
		const token = rawToken;
		const stepParts = token.split("/");
		const base = stepParts[0];
		const step = stepParts[1] ? Number.parseInt(stepParts[1], 10) : null;

		const matchesBase = (): boolean => {
			if (base === "*") {
				return true;
			}

			const rangeParts = base.split("-");
			if (rangeParts.length === 1) {
				const num = Number.parseInt(rangeParts[0], 10);
				if (!Number.isInteger(num)) {
					return false;
				}
				const normalizedNum = isDow && num === 7 ? 7 : num;
				return normalizedValue === normalizedNum;
			}

			const start = Number.parseInt(rangeParts[0], 10);
			const end = Number.parseInt(rangeParts[1], 10);
			if (!Number.isInteger(start) || !Number.isInteger(end)) {
				return false;
			}

			return normalizedValue >= start && normalizedValue <= end;
		};

		if (!matchesBase()) {
			continue;
		}

		if (step === null) {
			return true;
		}

		if (base === "*") {
			if ((normalizedValue - min) % step === 0) {
				return true;
			}
			continue;
		}

		const rangeParts = base.split("-");
		if (rangeParts.length === 1) {
			const num = Number.parseInt(rangeParts[0], 10);
			if (normalizedValue === num) {
				return true;
			}
			continue;
		}

		const start = Number.parseInt(rangeParts[0], 10);
		if ((normalizedValue - start) % step === 0) {
			return true;
		}
	}

	return false;
}

export function validateCronExpression(expr: string): boolean {
	const fields = expr.trim().split(/\s+/);
	if (fields.length !== 5) {
		return false;
	}

	const [minute, hour, day, month, dow] = fields;

	const allValid = [
		...minute.split(",").map((t) => validateToken(t.trim(), 0, 59)),
		...hour.split(",").map((t) => validateToken(t.trim(), 0, 23)),
		...day.split(",").map((t) => validateToken(t.trim(), 1, 31)),
		...month.split(",").map((t) => validateToken(t.trim(), 1, 12)),
		...dow.split(",").map((t) => validateToken(t.trim(), 0, 7)),
	];

	return allValid.every(Boolean);
}

export function cronMatchesNow(
	expr: string,
	now: Date,
	timeZone: string,
): boolean {
	const fields = expr.trim().split(/\s+/);
	if (fields.length !== 5) {
		return false;
	}

	const [minute, hour, day, month, dow] = fields;
	const local = toLocalParts(now, timeZone);

	return (
		fieldMatches(minute, local.minute, 0, 59) &&
		fieldMatches(hour, local.hour, 0, 23) &&
		fieldMatches(day, local.day, 1, 31) &&
		fieldMatches(month, local.month, 1, 12) &&
		fieldMatches(dow, local.dayOfWeek, 0, 7, true)
	);
}

function rowToSchedule(row: Record<string, unknown>): ScheduledMessage {
	return {
		id: String(row.id),
		chat_id: Number(row.chat_id),
		message_thread_id:
			row.message_thread_id === null
				? undefined
				: Number(row.message_thread_id),
		message: String(row.message),
		cron_expr: String(row.cron_expr),
		description: String(row.description),
		enabled: Number(row.enabled) === 1,
		task_name: row.task_name === null ? undefined : String(row.task_name),
	};
}

export async function listSchedules(env: Env): Promise<ScheduledMessage[]> {
	const result = await env.SCHEDULE_DB.prepare(
		"SELECT id, chat_id, message_thread_id, message, cron_expr, description, enabled, task_name FROM schedules ORDER BY created_at DESC",
	).all<Record<string, unknown>>();

	return (result.results ?? []).map(rowToSchedule);
}

export async function getScheduleById(
	env: Env,
	id: string,
): Promise<ScheduledMessage | null> {
	const row = await env.SCHEDULE_DB.prepare(
		"SELECT id, chat_id, message_thread_id, message, cron_expr, description, enabled, task_name FROM schedules WHERE id = ?",
	)
		.bind(id)
		.first<Record<string, unknown>>();

	return row ? rowToSchedule(row) : null;
}

function validateTaskName(taskName?: string): boolean {
	if (!taskName) {
		return true;
	}
	return Boolean(TaskMap[taskName]);
}

export function validateScheduleRequest(req: ScheduleRequest): string | null {
	if (!req.chat_id) {
		return "Missing required field: chat_id";
	}
	if (!req.cron_expr) {
		return "Missing required field: cron_expr";
	}
	if (!req.description) {
		return "Missing required field: description";
	}
	if (!validateCronExpression(req.cron_expr)) {
		return "Invalid cron expression";
	}
	if (!validateTaskName(req.task_name)) {
		return "Invalid task name";
	}
	if (!req.task_name && !req.message) {
		return "Missing required field: message";
	}
	return null;
}

export async function createSchedule(
	env: Env,
	req: ScheduleRequest,
): Promise<string> {
	const id = crypto.randomUUID();
	await env.SCHEDULE_DB.prepare(
		"INSERT INTO schedules (id, chat_id, message_thread_id, message, cron_expr, description, enabled, task_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(
			id,
			req.chat_id,
			req.message_thread_id ?? null,
			req.message ?? "",
			req.cron_expr,
			req.description,
			req.enabled ? 1 : 0,
			req.task_name ?? null,
		)
		.run();

	return id;
}

export async function updateSchedule(
	env: Env,
	id: string,
	req: ScheduleRequest,
): Promise<boolean> {
	const existing = await getScheduleById(env, id);
	if (!existing) {
		return false;
	}

	await env.SCHEDULE_DB.prepare(
		"UPDATE schedules SET chat_id = ?, message_thread_id = ?, message = ?, cron_expr = ?, description = ?, enabled = ?, task_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
	)
		.bind(
			req.chat_id,
			req.message_thread_id ?? null,
			req.message ?? "",
			req.cron_expr,
			req.description,
			req.enabled ? 1 : 0,
			req.task_name ?? null,
			id,
		)
		.run();

	return true;
}

export async function deleteSchedule(env: Env, id: string): Promise<boolean> {
	const result = await env.SCHEDULE_DB.prepare(
		"DELETE FROM schedules WHERE id = ?",
	)
		.bind(id)
		.run();
	return (result.meta.changes ?? 0) > 0;
}

export async function getEnabledSchedules(
	env: Env,
): Promise<ScheduledMessage[]> {
	const result = await env.SCHEDULE_DB.prepare(
		"SELECT id, chat_id, message_thread_id, message, cron_expr, description, enabled, task_name FROM schedules WHERE enabled = 1",
	).all<Record<string, unknown>>();

	return (result.results ?? []).map(rowToSchedule);
}
