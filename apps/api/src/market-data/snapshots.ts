import type {
  CachedPriceSnapshot,
  MarketState,
  PriceSnapshot,
  TwelveDataPriceEvent,
  TwelveDataQuote,
} from "./types.js";

export function toPublicSnapshot(
  snapshot: CachedPriceSnapshot,
  options: { now?: number; staleAfterMs: number; source?: PriceSnapshot["source"] },
): PriceSnapshot {
  const now = options.now ?? Date.now();
  const { receivedAt: _receivedAt, ...publicSnapshot } = snapshot;

  return {
    ...publicSnapshot,
    source: options.source ?? publicSnapshot.source,
    stale: now - snapshot.receivedAt > options.staleAfterMs,
  };
}

export function buildSnapshotFromQuote(
  symbol: string,
  quote: TwelveDataQuote,
  marketState: MarketState,
  options: {
    latestTickPrice?: string;
    latestTickTimestamp?: number;
    now?: number;
  } = {},
): CachedPriceSnapshot | null {
  const now = options.now ?? Date.now();
  const regularPrice = options.latestTickPrice ?? quote.close;
  const usesExtendedPrice = marketState !== "regular" && Boolean(quote.extended_price);
  const nonRegularPrice = quote.extended_price ?? quote.close ?? quote.previous_close;
  const price = marketState === "regular" ? regularPrice : nonRegularPrice;
  const timestamp =
    marketState === "regular"
      ? (options.latestTickTimestamp ?? quote.timestamp ?? Math.floor(now / 1000))
      : usesExtendedPrice
        ? (quote.extended_timestamp ?? quote.timestamp ?? Math.floor(now / 1000))
        : (quote.timestamp ?? Math.floor(now / 1000));

  if (!price) {
    return null;
  }

  return {
    symbol,
    price,
    open: quote.open ?? null,
    high: quote.high ?? null,
    low: quote.low ?? null,
    close: quote.close ?? null,
    previousClose: quote.previous_close ?? null,
    change: usesExtendedPrice
      ? (quote.extended_change ?? quote.change ?? null)
      : (quote.change ?? null),
    percentChange: usesExtendedPrice
      ? (quote.extended_percent_change ?? quote.percent_change ?? null)
      : (quote.percent_change ?? null),
    volume: quote.volume ?? null,
    timestamp,
    marketState,
    source: "quote_api",
    provider: "twelvedata",
    stale: false,
    receivedAt: now,
  };
}

export function mergeTickWithQuote(
  tick: Required<Pick<TwelveDataPriceEvent, "symbol" | "price">> &
    Pick<TwelveDataPriceEvent, "timestamp">,
  quote: TwelveDataQuote | undefined,
  marketState: MarketState,
  options: { now?: number } = {},
): CachedPriceSnapshot {
  const now = options.now ?? Date.now();
  const price = String(tick.price);

  return {
    symbol: tick.symbol,
    price,
    open: quote?.open ?? null,
    high: quote?.high ?? null,
    low: quote?.low ?? null,
    close: quote?.close ?? null,
    previousClose: quote?.previous_close ?? null,
    change: quote?.change ?? null,
    percentChange: quote?.percent_change ?? null,
    volume: quote?.volume ?? null,
    timestamp: tick.timestamp ?? Math.floor(now / 1000),
    marketState,
    source: "websocket",
    provider: "twelvedata",
    stale: false,
    receivedAt: now,
  };
}

export function parseCachedSnapshot(raw: string | null): CachedPriceSnapshot | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as CachedPriceSnapshot;
  } catch {
    return null;
  }
}
