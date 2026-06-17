import { db, type StockSplitAdjustment } from "../db.js";
import { recordGatewayLog } from "../services/gateway-logs.js";
import { backfillDailyOhlc, historicalBackfillStartDate } from "./historical-cache.js";
import { recomputeManualStockSplitAdjustments } from "./ohlc-adjustments.js";
import { parseMarketSymbol } from "./symbols.js";

export class StockSplitError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

type StockSplitMarket = "US" | "TSE";

function toDbDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function toDateString(date: Date | string) {
  return typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeNumberString(value: string | number) {
  const raw = String(value).trim();
  const numeric = Number(raw);

  if (!raw || !Number.isFinite(numeric) || numeric <= 0) {
    throw new StockSplitError("ratioFrom and ratioTo must be positive numbers");
  }

  return String(numeric);
}

function calculateFactor(ratioFrom: string, ratioTo: string) {
  const factor = Number(ratioTo) / Number(ratioFrom);

  if (!Number.isFinite(factor) || factor <= 0) {
    throw new StockSplitError("ratioFrom and ratioTo must produce a positive factor");
  }

  return String(factor);
}

function serializeStockSplit(row: StockSplitAdjustment) {
  return {
    id: row.id,
    symbol: row.symbol,
    market: row.market as StockSplitMarket,
    adjustmentDate: toDateString(row.adjustmentDate),
    ratioFrom: row.ratioFrom,
    ratioTo: row.ratioTo,
    factor: row.factor,
    active: row.active,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    providerRefreshedAt: row.providerRefreshedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type SerializedStockSplit = ReturnType<typeof serializeStockSplit>;

export async function listStockSplits(input: {
  symbols?: string[];
  from?: string;
  to?: string;
}) {
  const canonicalSymbols = input.symbols?.map((symbol) => {
    const parsed = parseMarketSymbol(symbol);

    if (!parsed) {
      throw new StockSplitError(`Unsupported symbol: ${symbol}`);
    }

    return parsed.canonical;
  });

  const rows = await db.stockSplitAdjustment.findMany({
    where: {
      ...(canonicalSymbols?.length
        ? {
            symbol: {
              in: Array.from(new Set(canonicalSymbols)),
            },
          }
        : {}),
      ...(input.from || input.to
        ? {
            adjustmentDate: {
              ...(input.from ? { gte: toDbDate(input.from) } : {}),
              ...(input.to ? { lte: toDbDate(input.to) } : {}),
            },
          }
        : {}),
    },
    orderBy: [
      {
        adjustmentDate: "desc",
      },
      {
        symbol: "asc",
      },
    ],
  });

  return rows.map(serializeStockSplit);
}

export async function createStockSplit(input: {
  symbol: string;
  adjustmentDate: string;
  ratioFrom: string | number;
  ratioTo: string | number;
}) {
  const parsed = parseMarketSymbol(input.symbol);

  if (!parsed) {
    throw new StockSplitError("Unsupported symbol");
  }

  const ratioFrom = normalizeNumberString(input.ratioFrom);
  const ratioTo = normalizeNumberString(input.ratioTo);
  const factor = calculateFactor(ratioFrom, ratioTo);
  const adjustmentDate = toDbDate(input.adjustmentDate);
  const existing = await db.stockSplitAdjustment.findUnique({
    where: {
      symbol_adjustmentDate: {
        symbol: parsed.canonical,
        adjustmentDate,
      },
    },
  });

  if (existing) {
    throw new StockSplitError("Stock split already exists for this symbol and date", 409);
  }

  const now = new Date();
  const split = await db.stockSplitAdjustment.create({
    data: {
      symbol: parsed.canonical,
      market: parsed.market,
      adjustmentDate,
      ratioFrom,
      ratioTo,
      factor,
      active: true,
      appliedAt: now,
    },
  });
  const adjustment = await recomputeManualStockSplitAdjustments(parsed.canonical);

  recordGatewayLog({
    source: "downstream",
    eventType: "stock_split_applied",
    message: "Applied manual stock split adjustment",
    symbols: [parsed.canonical],
    metadata: {
      adjustmentDate: input.adjustmentDate,
      ratioFrom,
      ratioTo,
      factor,
      adjustedRows: adjustment.adjustedRows,
    },
  });

  return {
    stockSplit: serializeStockSplit(split),
    adjustedRows: adjustment.adjustedRows,
  };
}

export async function refreshStockSplitFromProvider(id: string) {
  const split = await db.stockSplitAdjustment.findUnique({
    where: {
      id,
    },
  });

  if (!split) {
    throw new StockSplitError("Stock split not found", 404);
  }

  const parsed = parseMarketSymbol(split.symbol);

  if (!parsed) {
    throw new StockSplitError("Unsupported symbol");
  }

  await backfillDailyOhlc({
    parsed,
    from: historicalBackfillStartDate,
    to: todayString(),
  });

  const refreshed = await db.stockSplitAdjustment.update({
    where: {
      id,
    },
    data: {
      active: false,
      providerRefreshedAt: new Date(),
    },
  });
  const adjustment = await recomputeManualStockSplitAdjustments(split.symbol);

  recordGatewayLog({
    source: "downstream",
    eventType: "stock_split_provider_refreshed",
    message: "Refreshed stock split data from upstream provider",
    symbols: [split.symbol],
    metadata: {
      stockSplitId: id,
      adjustmentDate: toDateString(split.adjustmentDate),
      adjustedRows: adjustment.adjustedRows,
    },
  });

  return {
    stockSplit: serializeStockSplit(refreshed),
    adjustedRows: adjustment.adjustedRows,
  };
}
