import {
	createSchedule,
	deleteSchedule,
	getScheduleById,
	listSchedules,
	updateSchedule,
	validateScheduleRequest,
} from "../scheduler/schedules";
import type { Env, ScheduleRequest } from "../types";

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

async function parseScheduleRequest(
	request: Request,
): Promise<{ body?: unknown; error?: Response }> {
	try {
		return { body: (await request.json()) as unknown };
	} catch {
		return { error: jsonResponse(400, { error: "Invalid request body" }) };
	}
}

function extractScheduleId(pathname: string): string | null {
	if (!pathname.startsWith("/schedules/")) {
		return null;
	}

	const id = pathname.slice("/schedules/".length).trim();
	return id || null;
}

export async function handleSchedules(
	request: Request,
	env: Env,
	pathname: string,
): Promise<Response> {
	if (pathname === "/schedules") {
		if (request.method === "GET") {
			const schedules = await listSchedules(env);
			return jsonResponse(200, schedules);
		}

		if (request.method === "POST") {
			const parsed = await parseScheduleRequest(request);
			if (parsed.error) {
				return parsed.error;
			}

			const req = parsed.body as ScheduleRequest;
			const validationError = validateScheduleRequest(req);
			if (validationError) {
				return jsonResponse(400, { error: validationError });
			}

			const id = await createSchedule(env, req);
			return jsonResponse(200, {
				status: "success",
				message: "Schedule created",
				id,
			});
		}

		return jsonResponse(405, { error: "Method not allowed" });
	}

	const id = extractScheduleId(pathname);
	if (!id) {
		return jsonResponse(400, { error: "Schedule ID required" });
	}

	if (request.method === "GET") {
		const schedule = await getScheduleById(env, id);
		if (!schedule) {
			return jsonResponse(404, { error: "Schedule not found" });
		}
		return jsonResponse(200, schedule);
	}

	if (request.method === "PUT") {
		const parsed = await parseScheduleRequest(request);
		if (parsed.error) {
			return parsed.error;
		}

		const req = parsed.body as ScheduleRequest;
		const validationError = validateScheduleRequest(req);
		if (validationError) {
			return jsonResponse(400, { error: validationError });
		}

		const updated = await updateSchedule(env, id, req);
		if (!updated) {
			return jsonResponse(404, { error: "Schedule not found" });
		}

		return jsonResponse(200, {
			status: "success",
			message: "Schedule updated",
		});
	}

	if (request.method === "DELETE") {
		const deleted = await deleteSchedule(env, id);
		if (!deleted) {
			return jsonResponse(404, { error: "Schedule not found" });
		}

		return jsonResponse(200, {
			status: "success",
			message: "Schedule deleted",
		});
	}

	return jsonResponse(405, { error: "Method not allowed" });
}
