# TeyBot 🤖

> Personal Telegram bot powered by Cloudflare Workers.

## Features

- Telegram webhook endpoint: `POST /telegram/webhook`
- Outbound webhook endpoint: `POST /webhook`
- Schedule CRUD endpoints:
  - `GET /schedules`
  - `POST /schedules`
  - `GET /schedules/{id}`
  - `PUT /schedules/{id}`
  - `DELETE /schedules/{id}`
- Cron-triggered scheduled dispatch (every minute)
- Built-in scheduled tasks: `SGD_TO_MYR`, `TSLA_PRICE`, `KK_DAILY_QUOTA_AVAILABILITY`, `DAILY_JOB_SUMMARY`
- Health endpoints: `GET /` and `GET /health`
- `/start` command reply
- Default text echo for non-command messages
- KK quota alerts send only when slots are available
- Daily job run outcomes are persisted for summary reporting

## Setup

1. Install dependencies

```bash
npm install
```

2. Configure secrets

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_WEBHOOK_SECRET
wrangler secret put EXCHANGE_RATE_API_KEY
wrangler secret put FINNHUB_API_KEY
```

3. Create D1 database (if you do not already have one)

```bash
wrangler d1 create teybot
```

4. Apply migrations

```bash
wrangler d1 migrations apply teybot --local
```

5. Start local dev server

```bash
npm run dev
```

## Telegram Webhook

Set Telegram webhook URL to:

`https://<your-worker-domain>/telegram/webhook`

Recommended: use the same value for Telegram `secret_token` and `TELEGRAM_WEBHOOK_SECRET`.

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"<YOUR_WORKER_URL>/telegram/webhook","secret_token":"<YOUR_SECRET_TOKEN>"}'
```

## Outbound Webhook API

`POST /webhook`

Example request body:

```json
{
	"chat_id": -1001234567890,
	"message_thread_id": 49,
	"title": "System Alert",
	"message": "Backup completed successfully"
}
```

Notes:

- `chat_id`, `title`, and `message` are required.
- `message_thread_id` is optional.
- Messages are sent using Telegram `MarkdownV2` formatting with escaping.

## Schedules API

Example schedule request body:

```json
{
	"chat_id": -1002500967655,
	"message_thread_id": 49,
	"message": "Exchange Rate Cron",
	"cron_expr": "0 8 * * *",
	"description": "Sends daily exchange rate of SGD to MYR",
	"enabled": true,
	"task_name": "SGD_TO_MYR"
}
```

Notes:

- If `task_name` is set, it overrides `message` at send time.
- Supported task names: `SGD_TO_MYR`, `TSLA_PRICE`, `KK_DAILY_QUOTA_AVAILABILITY`, `DAILY_JOB_SUMMARY`.
- Scheduler timezone is controlled by `SCHEDULE_TIMEZONE`.
- Current `wrangler.toml` default is `Asia/Singapore`.
- `KK_DAILY_QUOTA_AVAILABILITY` suppresses sends when no slots are available, but still records run status for daily summary.
- Add one schedule with `task_name: DAILY_JOB_SUMMARY` at end of day (for example `59 23 * * *`) in your scheduler timezone to receive a daily digest.
