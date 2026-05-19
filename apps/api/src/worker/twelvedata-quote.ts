import { twelveDataApiKey, twelveDataRestBaseUrl } from "../config.js";
import type { TwelveDataQuote } from "../market-data/types.js";

type TwelveDataError = {
  status?: string;
  message?: string;
  code?: number;
};

function isTwelveDataError(value: unknown): value is TwelveDataError {
  return typeof value === "object" && value !== null && "status" in value;
}

export async function fetchQuote(symbol: string) {
  if (!twelveDataApiKey) {
    throw new Error("TWELVEDATA_API_KEY is required to fetch Quote API data");
  }

  const url = new URL("/quote", twelveDataRestBaseUrl);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", twelveDataApiKey);
  url.searchParams.set("prepost", "true");
  url.searchParams.set("format", "JSON");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Twelve Data Quote API failed for ${symbol}: HTTP ${response.status}`);
  }

  const json = (await response.json()) as TwelveDataQuote | TwelveDataError;

  if (isTwelveDataError(json) && json.status === "error") {
    throw new Error(`Twelve Data Quote API failed for ${symbol}: ${json.message ?? json.code}`);
  }

  return json as TwelveDataQuote;
}
