import { Hono, type Context } from "hono";
import { getCurrentUser } from "../auth/session.js";
import { recordGatewayLog } from "../services/gateway-logs.js";
import { validateServiceApiKey } from "../services/service-api-keys.js";
import {
  getCachedDailyOhlc,
  getCachedDailyOhlcBatch,
  getCachedOptions,
} from "./historical-cache.js";
import { parseMarketSymbol } from "./symbols.js";
import {
  createStockSplit,
  listStockSplits,
  refreshStockSplitFromProvider,
  StockSplitError,
} from "./stock-splits.js";
import type { MultiSymbolDailyOhlcResponse } from "./types.js";

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

async function validateMarketDataRequest(c: Context) {
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
    return false;
  }

  return true;
}

async function validateStockSplitRequest(c: Context) {
  const apiKey = c.req.header("x-api-key") ?? c.req.query("api_key");
  const serviceApiKey = apiKey ? await validateServiceApiKey(apiKey) : null;

  if (serviceApiKey) {
    return true;
  }

  const user = await getCurrentUser(c);

  if (user) {
    return true;
  }

  recordGatewayLog({
    source: "downstream",
    eventType: "auth_failed",
    message: "Rejected stock split request with invalid auth",
    metadata: {
      hasApiKey: Boolean(apiKey),
      path: c.req.path,
    },
  });

  return false;
}

function getStockSplitErrorStatus(error: unknown) {
  if (!(error instanceof StockSplitError)) {
    return 502;
  }

  if (error.status === 404 || error.status === 409) {
    return error.status;
  }

  return 400;
}

marketDataRoutes.use("/ohlc", async (c, next) => {
  if (!(await validateMarketDataRequest(c))) {
    return c.json({ message: "Invalid API key" }, 401);
  }

  return next();
});

marketDataRoutes.use("/daily-ohlc", async (c, next) => {
  if (!(await validateMarketDataRequest(c))) {
    return c.json({ message: "Invalid API key" }, 401);
  }

  return next();
});

marketDataRoutes.use("/options", async (c, next) => {
  if (!(await validateMarketDataRequest(c))) {
    return c.json({ message: "Invalid API key" }, 401);
  }

  return next();
});

marketDataRoutes.use("/stock-splits", async (c, next) => {
  if (!(await validateStockSplitRequest(c))) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  return next();
});

marketDataRoutes.get("/ohlc", async (c) => {
  const symbols = c.req.query("symbols");
  const from = c.req.query("from");
  const to = c.req.query("to");

  if (!symbols || !from || !to || !isDate(from) || !isDate(to)) {
    return c.json({ message: "symbols, from, and to=YYYY-MM-DD are required" }, 400);
  }

  if (from > to) {
    return c.json({ message: "from must be before or equal to to" }, 400);
  }

  const requestedSymbols = symbols
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);

  if (requestedSymbols.length === 0) {
    return c.json({ message: "At least one symbol is required" }, 400);
  }

  const parsedSymbols = requestedSymbols.map((symbol) => ({
    raw: symbol,
    parsed: parseMarketSymbol(symbol),
  }));
  const unsupportedSymbol = parsedSymbols.find((item) => !item.parsed);

  if (unsupportedSymbol) {
    return c.json({ message: `Unsupported symbol: ${unsupportedSymbol.raw}` }, 400);
  }

  const dedupedSymbols = Array.from(
    new Map(
      parsedSymbols.map((item) => {
        if (!item.parsed) {
          throw new Error("Unexpected unsupported symbol");
        }

        return [item.parsed.canonical, item.parsed];
      }),
    ).values(),
  );

  try {
    const results = await getCachedDailyOhlcBatch({
      parsedSymbols: dedupedSymbols,
      from,
      to,
    });

    const response: MultiSymbolDailyOhlcResponse = {
      from,
      to,
      results,
    };

    return c.json(response);
  } catch (error) {
    return c.json({ message: serializeError(error) }, 502);
  }
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
    return c.json(
      await getCachedDailyOhlc({
        parsed,
        from,
        to,
      }),
    );
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
    return c.json(
      await getCachedOptions({
        market,
        symbol,
        date: requestedDate,
        contract,
      }),
    );
  } catch (error) {
    return c.json({ message: serializeError(error) }, 502);
  }
});

marketDataRoutes.get("/stock-splits", async (c) => {
  const symbols = c.req.query("symbols");
  const from = c.req.query("from");
  const to = c.req.query("to");

  if ((from && !isDate(from)) || (to && !isDate(to))) {
    return c.json({ message: "from and to must be YYYY-MM-DD when provided" }, 400);
  }

  if (from && to && from > to) {
    return c.json({ message: "from must be before or equal to to" }, 400);
  }

  try {
    return c.json({
      stockSplits: await listStockSplits({
        symbols: symbols
          ?.split(",")
          .map((symbol) => symbol.trim())
          .filter(Boolean),
        from,
        to,
      }),
    });
  } catch (error) {
    return c.json({ message: serializeError(error) }, getStockSplitErrorStatus(error));
  }
});

marketDataRoutes.post("/stock-splits", async (c) => {
  const payload = (await c.req.json()) as {
    symbol?: string;
    adjustmentDate?: string;
    ratioFrom?: string | number;
    ratioTo?: string | number;
  };

  if (!payload.symbol || !isDate(payload.adjustmentDate)) {
    return c.json({ message: "symbol and adjustmentDate=YYYY-MM-DD are required" }, 400);
  }

  if (payload.ratioFrom === undefined || payload.ratioTo === undefined) {
    return c.json({ message: "ratioFrom and ratioTo are required" }, 400);
  }

  try {
    return c.json(
      await createStockSplit({
        symbol: payload.symbol,
        adjustmentDate: payload.adjustmentDate,
        ratioFrom: payload.ratioFrom,
        ratioTo: payload.ratioTo,
      }),
    );
  } catch (error) {
    return c.json({ message: serializeError(error) }, getStockSplitErrorStatus(error));
  }
});

marketDataRoutes.post("/stock-splits/:id/refresh", async (c) => {
  try {
    return c.json(await refreshStockSplitFromProvider(c.req.param("id")));
  } catch (error) {
    return c.json({ message: serializeError(error) }, getStockSplitErrorStatus(error));
  }
});
