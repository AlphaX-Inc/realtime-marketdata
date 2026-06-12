export const redisUrl = process.env.REDIS_URL ?? "redis://localhost:56379";

export const quotePollIntervalMs = Number(process.env.QUOTE_POLL_INTERVAL_MS ?? 30_000);
export const quoteClosedPollIntervalMs = Number(
  process.env.QUOTE_CLOSED_POLL_INTERVAL_MS ?? 60_000,
);
export const staleAfterMs = Number(process.env.STALE_AFTER_MS ?? 5_000);

export const twelveDataApiKey = process.env.TWELVEDATA_API_KEY;
export const twelveDataRestBaseUrl =
  process.env.TWELVEDATA_REST_BASE_URL ?? "https://api.twelvedata.com";
export const twelveDataWsUrl =
  process.env.TWELVEDATA_WS_URL ?? "wss://ws.twelvedata.com/v1/quotes/price";

export const jQuantsApiKey = process.env.JQUANTS_API_KEY;
export const jQuantsBaseUrl = process.env.JQUANTS_BASE_URL ?? "https://api.jquants.com";
export const jQuantsPollIntervalMs = Number(process.env.JQUANTS_POLL_INTERVAL_MS ?? 60_000);
export const jQuantsClosedPollIntervalMs = Number(
  process.env.JQUANTS_CLOSED_POLL_INTERVAL_MS ?? 900_000,
);

export const alphaVantageApiKey = process.env.ALPHAVANTAGE_API_KEY;
export const alphaVantageBaseUrl =
  process.env.ALPHAVANTAGE_BASE_URL ?? "https://www.alphavantage.co";
