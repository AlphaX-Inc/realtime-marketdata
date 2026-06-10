import { Hono } from "hono";
import { fetchAlphaVantageDailyBars, fetchAlphaVantageOptions } from "../providers/alphavantage.js";
import {
  fetchJQuantsDailyBars,
  fetchJQuantsOptions,
  normalizeJQuantsDailyBars,
} from "../providers/jquants.js";
import { recordGatewayLog } from "../services/gateway-logs.js";
import { validateServiceApiKey } from "../services/service-api-keys.js";
import { parseMarketSymbol } from "./symbols.js";
import type { DailyOhlcResponse } from "./types.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isDate(value: string | undefined): value is string {
  if (!value || !datePattern.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function serializeError(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected upstream error";
}

export const marketDataRoutes = new Hono();

marketDataRoutes.use("/daily-ohlc", async (c, next) => {
  const apiKey = c.req.header("x-api-key") ?? c.req.query("api_key");
  const serviceApiKey = apiKey ? await validateServiceApiKey(apiKey) : null;

  if (!serviceApiKey) {
    recordGatewayLog({
      source: "downstream",
      eventType: "auth_failed",
      message: "Rejected market data request with invalid API key",
      metadata: {
        hasApiKey: Boolean(apiKey),
        path: c.req.path,
      },
    });
    return c.json({ message: "Invalid API key" }, 401);
  }

  return next();
});

marketDataRoutes.use("/options", async (c, next) => {
  const apiKey = c.req.header("x-api-key") ?? c.req.query("api_key");
  const serviceApiKey = apiKey ? await validateServiceApiKey(apiKey) : null;

  if (!serviceApiKey) {
    recordGatewayLog({
      source: "downstream",
      eventType: "auth_failed",
      message: "Rejected market data request with invalid API key",
      metadata: {
        hasApiKey: Boolean(apiKey),
        path: c.req.path,
      },
    });
    return c.json({ message: "Invalid API key" }, 401);
  }

  return next();
});

marketDataRoutes.get("/daily-ohlc", async (c) => {
  const symbol = c.req.query("symbol");
  const from = c.req.query("from");
  const to = c.req.query("to");

  if (!symbol || !from || !to || !isDate(from) || !isDate(to)) {
    return c.json({ message: "symbol, from, and to=YYYY-MM-DD are required" }, 400);
  }

  if (from > to) {
    return c.json({ message: "from must be before or equal to to" }, 400);
  }

  const parsed = parseMarketSymbol(symbol);

  if (!parsed) {
    return c.json({ message: "Unsupported symbol" }, 400);
  }

  try {
    if (parsed.market === "TSE") {
      const bars = await fetchJQuantsDailyBars({
        code: parsed.jQuantsCode,
        from,
        to,
      });
      const response: DailyOhlcResponse = {
        symbol: parsed.canonical,
        market: "TSE",
        provider: "jquants",
        bars: normalizeJQuantsDailyBars(bars),
      };

      return c.json(response);
    }

    const response: DailyOhlcResponse = {
      symbol: parsed.canonical,
      market: "US",
      provider: "alphavantage",
      bars: await fetchAlphaVantageDailyBars({
        symbol: parsed.upstreamSymbol,
        from,
        to,
      }),
    };

    return c.json(response);
  } catch (error) {
    return c.json({ message: serializeError(error) }, 502);
  }
});

marketDataRoutes.get("/options", async (c) => {
  const market = c.req.query("market")?.toUpperCase();
  const symbol = c.req.query("symbol");
  const date = c.req.query("date");
  const contract = c.req.query("contract");

  if ((market !== "US" && market !== "JP") || !symbol || !isDate(date)) {
    return c.json({ message: "market=US|JP, symbol, and date=YYYY-MM-DD are required" }, 400);
  }

  const requestedDate = date;

  try {
    if (market === "JP") {
      return c.json(
        await fetchJQuantsOptions({
          symbol,
          date: requestedDate,
          contract,
        }),
      );
    }

    return c.json(
      await fetchAlphaVantageOptions({
        symbol,
        date: requestedDate,
        contract,
      }),
    );
  } catch (error) {
    return c.json({ message: serializeError(error) }, 502);
  }
});
