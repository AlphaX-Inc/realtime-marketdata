import { db, type Prisma } from "../db.js";
import { fetchAlphaVantageDailyBars, fetchAlphaVantageOptions } from "../providers/alphavantage.js";
import {
  fetchJQuantsDailyBars,
  fetchJQuantsOptions,
  normalizeJQuantsDailyBars,
} from "../providers/jquants.js";
import { recordGatewayLog } from "../services/gateway-logs.js";
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
  return {
    date: toDateString(row.date),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    adjustedOpen: row.adjustedOpen,
    adjustedHigh: row.adjustedHigh,
    adjustedLow: row.adjustedLow,
    adjustedClose: row.adjustedClose,
    adjustedVolume: row.adjustedVolume,
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

  if (latest && toDateString(latest.date) >= to) {
    return null;
  }

  const status = await db.dailyOhlcBackfillStatus.findUnique({
    where: {
      symbol,
    },
    select: {
      backfilledThrough: true,
    },
  });

  if (!status) {
    return {
      from: historicalBackfillStartDate,
      to,
    };
  }

  const backfilledThrough = toDateString(status.backfilledThrough);

  if (backfilledThrough >= to) {
    return null;
  }

  return {
    from: addDaysToDateString(backfilledThrough, 1),
    to,
  };
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
