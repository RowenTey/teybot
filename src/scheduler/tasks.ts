import type { Env } from "../types";

interface ExchangeRateResponse {
	conversion_rates?: Record<string, number>;
}

interface StockPriceResponse {
	c?: number;
}

export type TaskHandler = (env: Env) => Promise<string>;

export const TaskMap: Record<string, TaskHandler> = {
	SGD_TO_MYR: getExchangeRate,
	TSLA_PRICE: getTSLAPrice,
};

export async function getExchangeRate(env: Env): Promise<string> {
	const apiKey = env.EXCHANGE_RATE_API_KEY;
	if (!apiKey) {
		return "EXCHANGE_RATE_API_KEY environment variable not set";
	}

	const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/SGD`;

	try {
		const res = await fetch(url);
		if (!res.ok) {
			return `API request failed with status code: ${res.status}`;
		}

		const data = (await res.json()) as ExchangeRateResponse;
		const sgdToMyr = data.conversion_rates?.MYR;
		if (typeof sgdToMyr !== "number") {
			return "MYR conversion rate not found";
		}

		return `Conversion rates of SGD to MYR today is ${sgdToMyr.toFixed(4)}`;
	} catch (err) {
		return `Error making request: ${String(err)}`;
	}
}

export async function getTSLAPrice(env: Env): Promise<string> {
	const apiKey = env.FINNHUB_API_KEY;
	if (!apiKey) {
		return "FINNHUB_API_KEY environment variable not set";
	}

	const url = `https://finnhub.io/api/v1/quote?symbol=TSLA&token=${apiKey}`;

	try {
		const res = await fetch(url);
		if (!res.ok) {
			return `API request failed with status code: ${res.status}`;
		}

		const data = (await res.json()) as StockPriceResponse;
		if (typeof data.c !== "number") {
			return "TSLA price not available";
		}

		return `Current Price of TSLA today is $${data.c.toFixed(4)} (USD)`;
	} catch (err) {
		return `Error making request: ${String(err)}`;
	}
}
