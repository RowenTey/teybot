# TeyBot 🤖

> Personalized telegram bot for miscellaneous tasks with lightweight HTTP server and CRON worker in Go

## 🛠 Getting Started

1\. Install dependencies

```terminal
go mod tidy
```

2\. Populate env variables in `.env`

```terminal
cp .env.example .env
```

3\. Run application in `dev` mode

> [!WARNING]  
> Only 1 instance of the telegram bot can be run at any moment

```terminal
go run main.go dev
```

## ⏲️ CRON Confguration

Initial cron jobs can be configured via a `cron_config.json` in the **root directory**. See example below:

```json
// cron_config.json
[
	{
		// Generate a UUID (v4) with https://www.uuidgenerator.net/
		"id": "1d80439f-74c9-4367-8c2c-e18e7c353645",
		"chat_id": -1002500967658,
		"message_thread_id": 57, // optional
		"message": "Exchange Rate Cron",
		"cron_expr": "53 23 * * *",
		"description": "Sends daily exchange rate of SGD to MYR",
		"enabled": true,
		"task_name": "SGD_TO_MYR" // optional
	}
]
```

> [!TIP]  
> If `task_name` is set, it will take precedence over message to send.

## ❓ Custom Tasks

To define your own tasks, create a function in `src/util/` and add it to **TaskMap** in `src/util/index.go`. The function should always return a string.

## 📚 Docs

API docs are served at `/docs` endpoint
