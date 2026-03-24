import type { Env } from "../types";

interface ExchangeRateResponse {
	conversion_rates?: Record<string, number>;
}

interface StockPriceResponse {
	c?: number;
}

interface KkDailyQuotaItem {
	date: string;
	available_quota: number;
	max_quota: number;
	current_booking_value: number;
	product_id: number;
	id: number;
}

export interface TaskResult {
	text: string;
	shouldSend?: boolean;
	summary: string;
}

export type TaskHandler = (env: Env) => Promise<TaskResult>;

function taskResult(
	text: string,
	summary: string,
	shouldSend = true,
): TaskResult {
	return {
		text,
		summary,
		shouldSend,
	};
}

export const TaskMap: Record<string, TaskHandler> = {
	SGD_TO_MYR: getExchangeRate,
	TSLA_PRICE: getTSLAPrice,
	KK_DAILY_QUOTA_AVAILABILITY: getKkDailyQuotaAvailability,
	DAILY_JOB_SUMMARY: getDailyJobSummary,
};

export async function getExchangeRate(env: Env): Promise<TaskResult> {
	const apiKey = env.EXCHANGE_RATE_API_KEY;
	if (!apiKey) {
		const text = "EXCHANGE_RATE_API_KEY environment variable not set";
		return taskResult(text, "Missing EXCHANGE_RATE_API_KEY");
	}

	const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/SGD`;

	try {
		const res = await fetch(url);
		if (!res.ok) {
			const text = `API request failed with status code: ${res.status}`;
			return taskResult(text, `Exchange rate API failed (${res.status})`);
		}

		const data = (await res.json()) as ExchangeRateResponse;
		const sgdToMyr = data.conversion_rates?.MYR;
		if (typeof sgdToMyr !== "number") {
			const text = "MYR conversion rate not found";
			return taskResult(text, "Exchange rate missing MYR value");
		}

		const text = `Conversion rates of SGD to MYR today is ${sgdToMyr.toFixed(4)}`;
		return taskResult(text, `SGD/MYR ${sgdToMyr.toFixed(4)}`);
	} catch (err) {
		const text = `Error making request: ${String(err)}`;
		return taskResult(text, "Exchange rate request failed");
	}
}

export async function getTSLAPrice(env: Env): Promise<TaskResult> {
	const apiKey = env.FINNHUB_API_KEY;
	if (!apiKey) {
		const text = "FINNHUB_API_KEY environment variable not set";
		return taskResult(text, "Missing FINNHUB_API_KEY");
	}

	const url = `https://finnhub.io/api/v1/quote?symbol=TSLA&token=${apiKey}`;

	try {
		const res = await fetch(url);
		if (!res.ok) {
			const text = `API request failed with status code: ${res.status}`;
			return taskResult(text, `TSLA API failed (${res.status})`);
		}

		const data = (await res.json()) as StockPriceResponse;
		if (typeof data.c !== "number") {
			const text = "TSLA price not available";
			return taskResult(text, "TSLA quote missing current price");
		}

		const text = `Current Price of TSLA today is $${data.c.toFixed(4)} (USD)`;
		return taskResult(text, `TSLA $${data.c.toFixed(4)} (USD)`);
	} catch (err) {
		const text = `Error making request: ${String(err)}`;
		return taskResult(text, "TSLA quote request failed");
	}
}

async function fetchKkDailyQuotaInterval(
	productId: number,
	startDate: string,
	endDate: string,
): Promise<KkDailyQuotaItem[]> {
	const url = new URL(
		"https://sp-api.terazglobal.com.my/api/v1/public/daily_quotas/interval/",
	);
	url.searchParams.set("product_id", String(productId));
	url.searchParams.set("start_date", startDate);
	url.searchParams.set("end_date", endDate);

	const res = await fetch(url.toString());
	if (!res.ok) {
		throw new Error(`product ${productId} request failed (${res.status})`);
	}

	const data = (await res.json()) as unknown;
	if (!Array.isArray(data)) {
		throw new Error(`product ${productId} response is not an array`);
	}

	return data as KkDailyQuotaItem[];
}

function toProductStatusMessage(
	productId: number,
	rows: KkDailyQuotaItem[],
): { text: string; hasAvailability: boolean } {
	const productNameMap: Record<number, string> = {
		1: "LEMAING HOSTEL",
		2: "PANALABAN HOSTEL",
	};
	const productName = productNameMap[productId] ?? `Product ${productId}`;
	if (rows.length === 0) {
		return {
			text: `${productName}: no quota data returned`,
			hasAvailability: false,
		};
	}

	const hasAvailability = rows.some((row) => row.available_quota > 0);
	const overall = hasAvailability ? "AVAILABLE" : "FULLY BOOKED";
	const titlePrefix = hasAvailability ? "🚨 " : "";

	const dayLines = rows.map((row) => {
		const dayStatus = row.available_quota > 0 ? "available" : "full";
		return `${row.date}: ${dayStatus} (${row.available_quota}/${row.max_quota} left)`;
	});

	return {
		text: [`${titlePrefix}${productName} - ${overall}`, ...dayLines].join("\n"),
		hasAvailability,
	};
}

export async function getKkDailyQuotaAvailability(
	env: Env,
): Promise<TaskResult> {
	void env;

	const startDate = "2026-09-16";
	const endDate = "2026-09-19";
	const productIds = [1, 2];

	try {
		const results = await Promise.all(
			productIds.map(async (productId) => {
				const rows = await fetchKkDailyQuotaInterval(
					productId,
					startDate,
					endDate,
				);
				return toProductStatusMessage(productId, rows);
			}),
		);
		const hasAnyAvailability = results.some((result) => result.hasAvailability);
		const text = [
			`Daily KK quota availability (${startDate} to ${endDate})`,
			"",
			results.map((result) => result.text).join("\n\n"),
		].join("\n");

		if (!hasAnyAvailability) {
			return taskResult(
				text,
				`KK quota check ${startDate} to ${endDate}: no available slots`,
				false,
			);
		}

		return taskResult(
			text,
			`KK quota check ${startDate} to ${endDate}: slot available`,
		);
	} catch (err) {
		const text = `Error fetching daily quota availability: ${String(err)}`;
		return taskResult(text, "KK quota check failed", false);
	}
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

export async function getDailyJobSummary(env: Env): Promise<TaskResult> {
	const timeZone = env.SCHEDULE_TIMEZONE || "Asia/Kuala_Lumpur";
	const runDate = toLocalDate(new Date(), timeZone);
	const rowsResult = await env.SCHEDULE_DB.prepare(
		"SELECT schedule_id, description, task_name, status, was_sent, summary, executed_at FROM daily_job_runs WHERE run_date = ? AND IFNULL(task_name, '') != 'DAILY_JOB_SUMMARY' ORDER BY executed_at ASC",
	)
		.bind(runDate)
		.all<Record<string, unknown>>();

	const rows = rowsResult.results ?? [];
	if (rows.length === 0) {
		const text = `Daily job summary (${runDate}): no jobs executed.`;
		return taskResult(text, `Daily summary ${runDate}: no jobs`, true);
	}

	let sent = 0;
	let skipped = 0;
	let failed = 0;

	const details = rows.map((row) => {
		const status = String(row.status ?? "unknown");
		if (status === "sent") {
			sent += 1;
		} else if (status === "error") {
			failed += 1;
		} else {
			skipped += 1;
		}

		const name =
			(row.task_name && String(row.task_name)) ||
			(row.description && String(row.description)) ||
			String(row.schedule_id ?? "unknown");
		const summary = String(row.summary ?? "No details");
		return `- ${name}: ${status} (${summary})`;
	});

	const text = [
		`Daily job summary (${runDate}, ${timeZone})`,
		`Total: ${rows.length} | Sent: ${sent} | Skipped: ${skipped} | Failed: ${failed}`,
		"",
		details.join("\n"),
	].join("\n");

	return taskResult(
		text,
		`Daily summary ${runDate}: ${rows.length} jobs (sent ${sent}, skipped ${skipped}, failed ${failed})`,
		true,
	);
}
