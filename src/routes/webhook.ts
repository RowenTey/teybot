import { getBotAndHandler } from "../telegram";
import type { Env } from "../types";

interface MessageRequest {
	chat_id: number;
	message_thread_id?: number;
	title: string;
	message: string;
}

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function escapeMarkdownV2(input: string): string {
	const special = /[_*\[\]()~`>#+\-=|{}.!]/g;
	return input.replace(special, "\\$&");
}

export async function handleWebhookSend(
	request: Request,
	env: Env,
): Promise<Response> {
	let payload: MessageRequest;
	try {
		payload = (await request.json()) as MessageRequest;
	} catch {
		return jsonResponse(400, { error: "Invalid request body" });
	}

	if (!payload.chat_id) {
		return jsonResponse(400, { error: "Missing required field: chat_id" });
	}
	if (!payload.title) {
		return jsonResponse(400, { error: "Missing required field: title" });
	}
	if (!payload.message) {
		return jsonResponse(400, { error: "Missing required field: message" });
	}

	const { bot } = getBotAndHandler(env);
	const text = `*${escapeMarkdownV2(payload.title)}*\n\n${escapeMarkdownV2(payload.message)}`;

	try {
		await bot.api.sendMessage(payload.chat_id, text, {
			parse_mode: "MarkdownV2",
			message_thread_id: payload.message_thread_id,
		});
	} catch {
		return jsonResponse(500, { error: "Failed to send message" });
	}

	return new Response(null, { status: 200 });
}
