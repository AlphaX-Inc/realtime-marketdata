import { jQuantsApiKey, jQuantsBaseUrl } from "../config.js";
import type {
  CachedPriceSnapshot,
  DailyOhlcBar,
  MarketState,
  OptionsResponse,
} from "../market-data/types.js";

export type JQuantsDailyBar = {
  Date: string;
  Code: string;
  O?: number | null;
  H?: number | null;
  L?: number | null;
  C?: number | null;
  Vo?: number | null;
  AdjO?: number | null;
  AdjH?: number | null;
  AdjL?: number | null;
  AdjC?: number | null;
  AdjVo?: number | null;
};

type JQuantsDailyResponse = {
  data?: JQuantsDailyBar[];
  pagination_key?: string;
  message?: string;
};

type JQuantsOptionsResponse = {
  data?: Record<string, string | number | null>[];
  pagination_key?: string;
  message?: string;
};

type FetchDailyInput = {
  code: string;
  from?: string;
  to?: string;
  date?: string;
};

const latestLookbackDays = 180;
const maxPaginationPages = 30;

function requireApiKey() {
  if (!jQuantsApiKey) {
    throw new Error("JQUANTS_API_KEY is required to fetch J-Quants data");
  }

  return jQuantsApiKey;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function asString(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function getAdjustedOrRaw(
  bar: JQuantsDailyBar,
  adjustedKey: keyof JQuantsDailyBar,
  rawKey: keyof JQuantsDailyBar,
) {
  return asString(bar[adjustedKey] ?? bar[rawKey]);
}

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? value.toString()
    : value.toLocaleString("en-US", {
        maximumFractionDigits: 10,
        useGrouping: false,
      });
}

function toUnixSecondsFromTokyoDate(date: string) {
  return Math.floor(Date.parse(`${date}T00:00:00+09:00`) / 1000);
}

async function fetchJQuants<T>(path: string, params: Record<string, string | undefined>) {
  const url = new URL(path, jQuantsBaseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: {
      "x-api-key": requireApiKey(),
    },
  });

  if (!response.ok) {
    throw new Error(`J-Quants API failed for ${path}: HTTP ${response.status}`);
  }

  const json = (await response.json()) as T & { message?: string };

  if (json.message) {
    throw new Error(`J-Quants API failed for ${path}: ${json.message}`);
  }

  return json;
}

export async function fetchJQuantsDailyBars(input: FetchDailyInput) {
  const bars: JQuantsDailyBar[] = [];
  let paginationKey: string | undefined;
  let page = 0;

  do {
    const json = await fetchJQuants<JQuantsDailyResponse>("/v2/equities/bars/daily", {
      code: input.code,
      date: input.date,
      from: input.from,
      to: input.to,
      pagination_key: paginationKey,
    });

    bars.push(...(json.data ?? []));
    paginationKey = json.pagination_key;
    page += 1;
  } while (paginationKey && page < maxPaginationPages);

  return bars.sort((a, b) => a.Date.localeCompare(b.Date));
}

export async function fetchLatestJQuantsDailyBars(code: string, now = new Date()) {
  const to = formatDate(now);
  const from = formatDate(addDays(now, -latestLookbackDays));

  return fetchJQuantsDailyBars({
    code,
    from,
    to,
  });
}

export function normalizeJQuantsDailyBars(bars: JQuantsDailyBar[]): DailyOhlcBar[] {
  return bars.map((bar) => ({
    date: bar.Date,
    open: asString(bar.O),
    high: asString(bar.H),
    low: asString(bar.L),
    close: asString(bar.C),
    volume: asString(bar.Vo),
    adjustedOpen: asString(bar.AdjO),
    adjustedHigh: asString(bar.AdjH),
    adjustedLow: asString(bar.AdjL),
    adjustedClose: asString(bar.AdjC),
    adjustedVolume: asString(bar.AdjVo),
  }));
}

export function buildJQuantsSnapshot(
  symbol: string,
  bars: JQuantsDailyBar[],
  marketState: MarketState,
  options: { now?: number } = {},
): CachedPriceSnapshot | null {
  const latest = bars.at(-1);

  if (!latest) {
    return null;
  }

  const price = getAdjustedOrRaw(latest, "AdjC", "C");

  if (!price) {
    return null;
  }

  const previous = bars.length > 1 ? getAdjustedOrRaw(bars[bars.length - 2], "AdjC", "C") : null;
  const numericPrice = Number(price);
  const numericPrevious = Number(previous);
  const change =
    Number.isFinite(numericPrice) && Number.isFinite(numericPrevious)
      ? formatNumber(numericPrice - numericPrevious)
      : null;
  const percentChange =
    Number.isFinite(numericPrice) && Number.isFinite(numericPrevious) && numericPrevious !== 0
      ? formatNumber(((numericPrice - numericPrevious) / numericPrevious) * 100)
      : null;
  const now = options.now ?? Date.now();

  return {
    symbol,
    price,
    open: getAdjustedOrRaw(latest, "AdjO", "O"),
    high: getAdjustedOrRaw(latest, "AdjH", "H"),
    low: getAdjustedOrRaw(latest, "AdjL", "L"),
    close: price,
    previousClose: previous,
    change,
    percentChange,
    volume: getAdjustedOrRaw(latest, "AdjVo", "Vo"),
    timestamp: toUnixSecondsFromTokyoDate(latest.Date),
    marketState,
    source: "jquants_daily",
    provider: "jquants",
    stale: false,
    receivedAt: now,
  };
}

export async function fetchJQuantsOptions(input: {
  date: string;
  symbol?: string;
  contract?: string;
}): Promise<OptionsResponse> {
  const contracts: Record<string, string | number | null>[] = [];
  let paginationKey: string | undefined;
  let page = 0;

  do {
    const json = await fetchJQuants<JQuantsOptionsResponse>("/v2/derivatives/bars/daily/options", {
      date: input.date,
      pagination_key: paginationKey,
    });

    contracts.push(...(json.data ?? []));
    paginationKey = json.pagination_key;
    page += 1;
  } while (paginationKey && page < maxPaginationPages);

  const symbol = input.symbol?.toUpperCase();
  const contract = input.contract?.toUpperCase();
  const filtered = contracts.filter((item) => {
    const code = String(item.Code ?? "").toUpperCase();
    const underlying = String(item.UndSSO ?? "").toUpperCase();

    if (contract && code !== contract) {
      return false;
    }

    if (symbol && code !== symbol && underlying !== symbol) {
      return false;
    }

    return true;
  });

  return {
    market: "JP",
    provider: "jquants",
    symbol: input.symbol ?? input.contract ?? "",
    date: input.date,
    contracts: filtered,
  };
}
