import { alphaVantageApiKey, alphaVantageBaseUrl } from "../config.js";
import type { DailyOhlcBar, OptionsResponse } from "../market-data/types.js";

type AlphaVantageDailyResponse = {
  "Meta Data"?: Record<string, string>;
  "Time Series (Daily)"?: Record<
    string,
    {
      "1. open"?: string;
      "2. high"?: string;
      "3. low"?: string;
      "4. close"?: string;
      "5. adjusted close"?: string;
      "6. volume"?: string;
      "7. dividend amount"?: string;
      "8. split coefficient"?: string;
    }
  >;
  Note?: string;
  Information?: string;
  "Error Message"?: string;
};

type AlphaVantageOptionsResponse = {
  endpoint?: string;
  message?: string;
  data?: Record<string, string | number | null>[];
  Note?: string;
  Information?: string;
  "Error Message"?: string;
};

function requireApiKey() {
  if (!alphaVantageApiKey) {
    throw new Error("ALPHAVANTAGE_API_KEY is required to fetch Alpha Vantage data");
  }

  return alphaVantageApiKey;
}

async function fetchAlphaVantage<T>(params: Record<string, string | undefined>) {
  const url = new URL("/query", alphaVantageBaseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  url.searchParams.set("apikey", requireApiKey());

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Alpha Vantage API failed: HTTP ${response.status}`);
  }

  const json = (await response.json()) as T &
    Pick<AlphaVantageDailyResponse, "Error Message" | "Information" | "Note">;

  if (json["Error Message"]) {
    throw new Error(`Alpha Vantage API failed: ${json["Error Message"]}`);
  }

  if (json.Note || json.Information) {
    throw new Error(`Alpha Vantage API failed: ${json.Note ?? json.Information}`);
  }

  return json;
}

function toNumber(value: string | undefined) {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const fixed = value.toFixed(10);
  const trimmed = fixed.replace(/\.?0+$/, "");

  return trimmed === "-0" ? "0" : trimmed;
}

function adjustPrice(value: string | undefined, factor: number) {
  const numeric = toNumber(value);

  if (numeric === null) {
    return value ?? null;
  }

  return formatNumber(numeric / factor);
}

function adjustVolume(value: string | undefined, factor: number) {
  const numeric = toNumber(value);

  if (numeric === null) {
    return value ?? null;
  }

  return formatNumber(numeric * factor);
}

function getSplitCoefficient(value: string | undefined) {
  const numeric = toNumber(value);

  return numeric && numeric > 0 ? numeric : 1;
}

export async function fetchAlphaVantageDailyBars(input: {
  symbol: string;
  from: string;
  to: string;
}) {
  const json = await fetchAlphaVantage<AlphaVantageDailyResponse>({
    function: "TIME_SERIES_DAILY_ADJUSTED",
    symbol: input.symbol,
    outputsize: "full",
  });
  const series = json["Time Series (Daily)"] ?? {};
  const adjustedBars: DailyOhlcBar[] = [];
  let cumulativeSplitFactor = 1;

  // Walk newest to oldest so a split date adjusts only prior historical rows.
  for (const [date, bar] of Object.entries(series).sort(([a], [b]) => b.localeCompare(a))) {
    adjustedBars.push({
      date,
      open: bar["1. open"] ?? null,
      high: bar["2. high"] ?? null,
      low: bar["3. low"] ?? null,
      close: bar["4. close"] ?? null,
      volume: bar["6. volume"] ?? null,
      adjustedOpen: adjustPrice(bar["1. open"], cumulativeSplitFactor),
      adjustedHigh: adjustPrice(bar["2. high"], cumulativeSplitFactor),
      adjustedLow: adjustPrice(bar["3. low"], cumulativeSplitFactor),
      adjustedClose: adjustPrice(bar["4. close"], cumulativeSplitFactor),
      adjustedVolume: adjustVolume(bar["6. volume"], cumulativeSplitFactor),
    });

    cumulativeSplitFactor *= getSplitCoefficient(bar["8. split coefficient"]);
  }

  return adjustedBars
    .filter((bar) => bar.date >= input.from && bar.date <= input.to)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchAlphaVantageOptions(input: {
  symbol: string;
  date: string;
  contract?: string;
}): Promise<OptionsResponse> {
  const json = await fetchAlphaVantage<AlphaVantageOptionsResponse>({
    function: "HISTORICAL_OPTIONS",
    symbol: input.symbol,
    date: input.date,
  });
  const contract = input.contract?.toUpperCase();
  const contracts = (json.data ?? []).filter((item) => {
    if (!contract) {
      return true;
    }

    return String(item.contractID ?? "").toUpperCase() === contract;
  });

  return {
    market: "US",
    provider: "alphavantage",
    symbol: input.symbol.toUpperCase(),
    date: input.date,
    contracts,
  };
}
