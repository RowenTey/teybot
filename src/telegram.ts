import { Bot, webhookCallback } from "grammy";
import type { Env } from "./types";

function createBot(env: Env): Bot {
	const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

	bot.command("start", async (ctx) => {
		const username = ctx.from?.username ?? "there";
		await ctx.reply(`Hello, ${username}. This bot is online.`);
	});

	bot.on("message:text", async (ctx) => {
		if (ctx.message.text.startsWith("/")) {
			return;
		}

		await ctx.reply(ctx.message.text);
	});

	return bot;
}

let cachedToken: string | null = null;
let cachedBot: Bot | null = null;
let cachedHandler: ((request: Request) => Promise<Response>) | null = null;

export function getBotAndHandler(env: Env): {
	bot: Bot;
	handler: (request: Request) => Promise<Response>;
} {
	if (cachedHandler && cachedBot && cachedToken === env.TELEGRAM_BOT_TOKEN) {
		return { bot: cachedBot, handler: cachedHandler };
	}

	const bot = createBot(env);
	const handler = webhookCallback(bot, "cloudflare-mod");

	cachedToken = env.TELEGRAM_BOT_TOKEN;
	cachedBot = bot;
	cachedHandler = handler;

	return { bot, handler };
}

export function isWebhookAuthorized(request: Request, env: Env): boolean {
	if (!env.TELEGRAM_WEBHOOK_SECRET) {
		return true;
	}

	const token = request.headers.get("x-telegram-bot-api-secret-token");
	return token === env.TELEGRAM_WEBHOOK_SECRET;
}
