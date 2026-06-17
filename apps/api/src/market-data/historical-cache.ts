import { db, type Prisma } from "../db.js";
import { fetchAlphaVantageDailyBars, fetchAlphaVantageOptions } from "../providers/alphavantage.js";
import {
  fetchJQuantsDailyBars,
  fetchJQuantsOptions,
  normalizeJQuantsDailyBars,
} from "../providers/jquants.js";
import { recordGatewayLog } from "../services/gateway-logs.js";
import { recomputeManualStockSplitAdjustments } from "./ohlc-adjustments.js";
import type { ParsedMarketSymbol } from "./symbols.js";
import type { DailyOhlcBar, DailyOhlcResponse, OptionsResponse } from "./types.js";

export const historicalBackfillStartDate = "2025-01-01";

type DailyOhlcRow = {
  date: Date | string;
  open: string | null;
  high: string | null;
  low: string | null;
  close: string | null;
  volume: string | null;
  adjustedOpen: string | null;
  adjustedHigh: string | null;
  adjustedLow: string | null;
  adjustedClose: string | null;
  adjustedVolume: string | null;
  manualAdjustedOpen?: string | null;
  manualAdjustedHigh?: string | null;
  manualAdjustedLow?: string | null;
  manualAdjustedClose?: string | null;
  manualAdjustedVolume?: string | null;
  manualAdjustedAt?: Date | string | null;
};

function toDbDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function toDateString(date: Date | string) {
  return typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
}

function addDaysToDateString(date: string, days: number) {
  const value = toDbDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return toDateString(value);
}

function toDailyOhlcBar(row: DailyOhlcRow): DailyOhlcBar {
  const hasManualAdjustment = Boolean(row.manualAdjustedAt);
  const open = row.manualAdjustedOpen ?? row.open;
  const high = row.manualAdjustedHigh ?? row.high;
  const low = row.manualAdjustedLow ?? row.low;
  const close = row.manualAdjustedClose ?? row.close;
  const volume = row.manualAdjustedVolume ?? row.volume;

  return {
    date: toDateString(row.date),
    open,
    high,
    low,
    close,
    volume,
    adjustedOpen: hasManualAdjustment ? open : row.adjustedOpen,
    adjustedHigh: hasManualAdjustment ? high : row.adjustedHigh,
    adjustedLow: hasManualAdjustment ? low : row.adjustedLow,
    adjustedClose: hasManualAdjustment ? close : row.adjustedClose,
    adjustedVolume: hasManualAdjustment ? volume : row.adjustedVolume,
  };
}

function getProvider(parsed: ParsedMarketSymbol) {
  return parsed.market === "TSE" ? "jquants" : "alphavantage";
}

async function readDailyOhlcBars(symbol: string, from: string, to: string) {
  const rows = await db.dailyOhlcBar.findMany({
    where: {
      symbol,
      date: {
        gte: toDbDate(from),
        lte: toDbDate(to),
      },
    },
    orderBy: {
      date: "asc",
    },
  });

  return rows.map(toDailyOhlcBar);
}

async function readDailyOhlcBarsBySymbol(symbols: string[], from: string, to: string) {
  const rows = await db.dailyOhlcBar.findMany({
    where: {
      symbol: {
        in: symbols,
      },
      date: {
        gte: toDbDate(from),
        lte: toDbDate(to),
      },
    },
    orderBy: [
      {
        symbol: "asc",
      },
      {
        date: "asc",
      },
    ],
  });
  const barsBySymbol = new Map<string, DailyOhlcBar[]>();

  for (const row of rows) {
    const bars = barsBySymbol.get(row.symbol) ?? [];
    bars.push(toDailyOhlcBar(row));
    barsBySymbol.set(row.symbol, bars);
  }

  return barsBySymbol;
}

function getBackfillRange(input: {
  latestDate?: Date | string | null;
  backfilledThrough?: Date | string | null;
  to: string;
}) {
  if (input.latestDate && toDateString(input.latestDate) >= input.to) {
    return null;
  }

  if (!input.backfilledThrough) {
    return {
      from: historicalBackfillStartDate,
      to: input.to,
    };
  }

  const backfilledThrough = toDateString(input.backfilledThrough);

  if (backfilledThrough >= input.to) {
    return null;
  }

  return {
    from: addDaysToDateString(backfilledThrough, 1),
    to: input.to,
  };
}

async function getDailyOhlcBackfillRange(symbol: string, to: string) {
  const latest = await db.dailyOhlcBar.findFirst({
    where: {
      symbol,
    },
    orderBy: {
      date: "desc",
    },
    select: {
      date: true,
    },
  });

  const status = await db.dailyOhlcBackfillStatus.findUnique({
    where: {
      symbol,
    },
    select: {
      backfilledThrough: true,
    },
  });

  return getBackfillRange({
    latestDate: latest?.date,
    backfilledThrough: status?.backfilledThrough,
    to,
  });
}

async function upsertDailyOhlcBars(input: {
  parsed: ParsedMarketSymbol;
  provider: "alphavantage" | "jquants";
  bars: DailyOhlcBar[];
}) {
  const barsByDate = new Map(input.bars.map((bar) => [bar.date, bar]));

  await Promise.all(
    Array.from(barsByDate.values()).map((bar) =>
      db.dailyOhlcBar.upsert({
        where: {
          symbol_date: {
            symbol: input.parsed.canonical,
            date: toDbDate(bar.date),
          },
        },
        create: {
          symbol: input.parsed.canonical,
          market: input.parsed.market,
          provider: input.provider,
          date: toDbDate(bar.date),
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
          adjustedOpen: bar.adjustedOpen ?? null,
          adjustedHigh: bar.adjustedHigh ?? null,
          adjustedLow: bar.adjustedLow ?? null,
          adjustedClose: bar.adjustedClose ?? null,
          adjustedVolume: bar.adjustedVolume ?? null,
        },
        update: {
          provider: input.provider,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
          adjustedOpen: bar.adjustedOpen ?? null,
          adjustedHigh: bar.adjustedHigh ?? null,
          adjustedLow: bar.adjustedLow ?? null,
          adjustedClose: bar.adjustedClose ?? null,
          adjustedVolume: bar.adjustedVolume ?? null,
        },
      }),
    ),
  );
}

export async function backfillDailyOhlc(input: {
  parsed: ParsedMarketSymbol;
  from?: string;
  to: string;
}) {
  const provider = getProvider(input.parsed);
  const from = input.from ?? historicalBackfillStartDate;

  try {
    const bars =
      input.parsed.market === "TSE"
        ? normalizeJQuantsDailyBars(
            await fetchJQuantsDailyBars({
              code: input.parsed.jQuantsCode,
              from,
              to: input.to,
            }),
          )
        : await fetchAlphaVantageDailyBars({
            symbol: input.parsed.upstreamSymbol,
            from,
            to: input.to,
          });

    await upsertDailyOhlcBars({
      parsed: input.parsed,
      provider,
      bars,
    });
    await recomputeManualStockSplitAdjustments(input.parsed.canonical);

    await db.dailyOhlcBackfillStatus.upsert({
      where: {
        symbol: input.parsed.canonical,
      },
      create: {
        symbol: input.parsed.canonical,
        market: input.parsed.market,
        provider,
        backfilledThrough: toDbDate(input.to),
      },
      update: {
        market: input.parsed.market,
        provider,
        backfilledThrough: toDbDate(input.to),
      },
    });
  } catch (error) {
    recordGatewayLog({
      source: "upstream",
      eventType: "ohlc_backfill_failed",
      message: error instanceof Error ? error.message : "Failed to backfill OHLC data",
      symbols: [input.parsed.canonical],
      metadata: {
        from,
        to: input.to,
        provider,
      },
    });
    throw error;
  }
}

export async function getCachedDailyOhlc(input: {
  parsed: ParsedMarketSymbol;
  from: string;
  to: string;
}): Promise<DailyOhlcResponse> {
  const provider = getProvider(input.parsed);
  const backfillRange = await getDailyOhlcBackfillRange(input.parsed.canonical, input.to);

  if (backfillRange) {
    recordGatewayLog({
      source: "downstream",
      eventType: "ohlc_cache_miss",
      message: "Backfilling cached OHLC data",
      symbols: [input.parsed.canonical],
      metadata: {
        from: backfillRange.from,
        to: input.to,
        provider,
      },
    });

    await backfillDailyOhlc({
      parsed: input.parsed,
      from: backfillRange.from,
      to: input.to,
    });
  }

  return {
    symbol: input.parsed.canonical,
    market: input.parsed.market,
    provider,
    bars: await readDailyOhlcBars(input.parsed.canonical, input.from, input.to),
  };
}

export async function getCachedDailyOhlcBatch(input: {
  parsedSymbols: ParsedMarketSymbol[];
  from: string;
  to: string;
}): Promise<DailyOhlcResponse[]> {
  const symbols = input.parsedSymbols.map((parsed) => parsed.canonical);
  const [latestRows, statuses] = await Promise.all([
    db.dailyOhlcBar.groupBy({
      by: ["symbol"],
      where: {
        symbol: {
          in: symbols,
        },
      },
      _max: {
        date: true,
      },
    }),
    db.dailyOhlcBackfillStatus.findMany({
      where: {
        symbol: {
          in: symbols,
        },
      },
      select: {
        symbol: true,
        backfilledThrough: true,
      },
    }),
  ]);
  const latestDateBySymbol = new Map(latestRows.map((row) => [row.symbol, row._max.date ?? null]));
  const backfilledThroughBySymbol = new Map(
    statuses.map((status) => [status.symbol, status.backfilledThrough]),
  );
  const backfills = input.parsedSymbols
    .map((parsed) => ({
      parsed,
      provider: getProvider(parsed),
      range: getBackfillRange({
        latestDate: latestDateBySymbol.get(parsed.canonical),
        backfilledThrough: backfilledThroughBySymbol.get(parsed.canonical),
        to: input.to,
      }),
    }))
    .filter(
      (item): item is typeof item & { range: { from: string; to: string } } => item.range !== null,
    );

  await Promise.all(
    backfills.map((item) => {
      recordGatewayLog({
        source: "downstream",
        eventType: "ohlc_cache_miss",
        message: "Backfilling cached OHLC data",
        symbols: [item.parsed.canonical],
        metadata: {
          from: item.range.from,
          to: item.range.to,
          provider: item.provider,
        },
      });

      return backfillDailyOhlc({
        parsed: item.parsed,
        from: item.range.from,
        to: item.range.to,
      });
    }),
  );

  const barsBySymbol = await readDailyOhlcBarsBySymbol(symbols, input.from, input.to);

  return input.parsedSymbols.map((parsed) => ({
    symbol: parsed.canonical,
    market: parsed.market,
    provider: getProvider(parsed),
    bars: barsBySymbol.get(parsed.canonical) ?? [],
  }));
}

type OptionsMarket = "US" | "JP";

function getOptionsProvider(market: OptionsMarket) {
  return market === "JP" ? "jquants" : "alphavantage";
}

function getContractId(contract: Record<string, string | number | null>) {
  return String(contract.contractID ?? contract.Code ?? "").toUpperCase();
}

function filterContracts(
  contracts: Record<string, string | number | null>[],
  contract: string | undefined,
) {
  const requestedContract = contract?.toUpperCase();

  if (!requestedContract) {
    return contracts;
  }

  return contracts.filter((item) => getContractId(item) === requestedContract);
}

export async function getCachedOptions(input: {
  market: OptionsMarket;
  symbol: string;
  date: string;
  contract?: string;
}): Promise<OptionsResponse> {
  const symbol = input.symbol.toUpperCase();
  const provider = getOptionsProvider(input.market);
  const rows = await db.optionContractDaily.findMany({
    where: {
      market: input.market,
      symbol,
      date: toDbDate(input.date),
      ...(input.contract
        ? {
            contractId: input.contract.toUpperCase(),
          }
        : {}),
    },
    orderBy: {
      contractId: "asc",
    },
  });

  if (rows.length > 0) {
    return {
      market: input.market,
      provider,
      symbol,
      date: input.date,
      contracts: rows.map((row) => row.payload as Record<string, string | number | null>),
    };
  }

  recordGatewayLog({
    source: "downstream",
    eventType: "options_cache_miss",
    message: "Backfilling cached options data",
    symbols: [symbol],
    metadata: {
      market: input.market,
      date: input.date,
      contract: input.contract,
      provider,
    },
  });

  try {
    const response =
      input.market === "JP"
        ? await fetchJQuantsOptions({
            symbol,
            date: input.date,
          })
        : await fetchAlphaVantageOptions({
            symbol,
            date: input.date,
          });

    await Promise.all(
      response.contracts.map((item) => {
        const contractId = getContractId(item);

        if (!contractId) {
          return Promise.resolve();
        }

        return db.optionContractDaily.upsert({
          where: {
            market_symbol_date_contractId: {
              market: input.market,
              symbol,
              date: toDbDate(input.date),
              contractId,
            },
          },
          create: {
            market: input.market,
            provider,
            symbol,
            date: toDbDate(input.date),
            contractId,
            payload: item as Prisma.InputJsonValue,
          },
          update: {
            payload: item as Prisma.InputJsonValue,
          },
        });
      }),
    );

    return {
      ...response,
      market: input.market,
      provider,
      symbol,
      contracts: filterContracts(response.contracts, input.contract),
    };
  } catch (error) {
    recordGatewayLog({
      source: "upstream",
      eventType: "options_backfill_failed",
      message: error instanceof Error ? error.message : "Failed to backfill options data",
      symbols: [symbol],
      metadata: {
        market: input.market,
        date: input.date,
        contract: input.contract,
        provider,
      },
    });
    throw error;
  }
}
