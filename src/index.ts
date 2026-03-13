import { handleSchedules } from "./routes/schedules";
import { handleWebhookSend } from "./routes/webhook";
import { runScheduledDispatch } from "./scheduler/runner";
import { getBotAndHandler, isWebhookAuthorized } from "./telegram";
import type { Env } from "./types";

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (
			request.method === "GET" &&
			(url.pathname === "/" || url.pathname === "/health")
		) {
			return new Response("TeyBot is healthy :)", { status: 200 });
		}

		if (request.method === "POST" && url.pathname === "/telegram/webhook") {
			if (!isWebhookAuthorized(request, env)) {
				return new Response("Forbidden", { status: 403 });
			}
			const { handler } = getBotAndHandler(env);
			return handler(request);
		}

		if (request.method === "POST" && url.pathname === "/webhook") {
			return handleWebhookSend(request, env);
		}

		if (
			url.pathname === "/schedules" ||
			url.pathname.startsWith("/schedules/")
		) {
			return handleSchedules(request, env, url.pathname);
		}

		return new Response("Not Found", { status: 404 });
	},

	async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
		await runScheduledDispatch(env, new Date());
	},
} satisfies ExportedHandler<Env>;
