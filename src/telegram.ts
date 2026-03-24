import { Bot, webhookCallback } from "grammy";
import type { Env } from "./types";

function isBotMentionedInTextMessage(
	text: string,
	entities: Array<{ type: string; offset: number; length: number }> | undefined,
	botUsername: string,
): boolean {
	const target = botUsername.toLowerCase();

	for (const entity of entities ?? []) {
		if (entity.type !== "mention") {
			continue;
		}

		const mention = text.slice(entity.offset, entity.offset + entity.length);
		const mentionedUser = mention.replace(/^@/, "").toLowerCase();
		if (mentionedUser === target) {
			return true;
		}
	}

	const mentionMatches = text.match(/@[a-zA-Z0-9_]+/g) ?? [];
	for (const mention of mentionMatches) {
		if (mention.slice(1).toLowerCase() === target) {
			return true;
		}
	}

	return false;
}

function createBot(env: Env): Bot {
	const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
	let cachedBotUsername: string | null = null;

	const getBotUsername = async (): Promise<string | null> => {
		if (cachedBotUsername) {
			return cachedBotUsername;
		}

		try {
			const me = await bot.api.getMe();
			cachedBotUsername = me.username ?? null;
			return cachedBotUsername;
		} catch (error) {
			console.error("Failed to resolve bot username", error);
			return null;
		}
	};

	bot.command("start", async (ctx) => {
		const username = ctx.from?.username ?? "there";
		await ctx.reply(`Hello, ${username}. This bot is online.`);
	});

	bot.on("message:text", async (ctx) => {
		if (ctx.message.text.startsWith("/")) {
			return;
		}

		const isGroupChat =
			ctx.message.chat.type === "group" ||
			ctx.message.chat.type === "supergroup";
		if (isGroupChat) {
			const botUsername = await getBotUsername();
			if (!botUsername) {
				console.warn(
					`Skipping group reply for chat ${ctx.message.chat.id} because bot username is unavailable`,
				);
				return;
			}

			const isMentioned = isBotMentionedInTextMessage(
				ctx.message.text,
				ctx.message.entities,
				botUsername,
			);
			if (!isMentioned) {
				console.log(
					`Ignoring group message without mention in chat ${ctx.message.chat.id}: ${ctx.message.text}`,
				);
				return;
			}
		}

		console.log(
			`Received message from ${ctx.from?.username ?? "unknown"} via chat ID ${ctx.message.chat.id}: ${ctx.message.text}`,
		);
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
