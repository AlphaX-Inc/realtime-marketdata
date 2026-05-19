import { Redis } from "ioredis";
import {
  desiredSymbolLeaseKey,
  desiredSymbolLeasePrefix,
  marketDataChannels,
  snapshotKey,
} from "./redis-keys.js";
import { parseCachedSnapshot, toPublicSnapshot } from "./snapshots.js";
import type { CachedPriceSnapshot, MarketDataCommand, PriceMessage } from "./types.js";

const desiredLeaseTtlSeconds = 15;
const snapshotTtlSeconds = 60 * 60 * 24;

export function createRedisClient(redisUrl: string) {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });
}

export async function publishCommand(redis: Redis, command: MarketDataCommand) {
  await redis.publish(marketDataChannels.commands, JSON.stringify(command));
}

export async function refreshDesiredSymbolLeases(redis: Redis, symbols: string[]) {
  if (symbols.length === 0) {
    return;
  }

  const pipeline = redis.pipeline();

  for (const symbol of symbols) {
    pipeline.set(desiredSymbolLeaseKey(symbol), symbol, "EX", desiredLeaseTtlSeconds);
  }

  await pipeline.exec();
}

export async function removeDesiredSymbolLeases(redis: Redis, symbols: string[]) {
  if (symbols.length === 0) {
    return;
  }

  await redis.del(...symbols.map(desiredSymbolLeaseKey));
}

export async function listDesiredSymbols(redis: Redis) {
  let cursor = "0";
  const symbols = new Set<string>();

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      `${desiredSymbolLeasePrefix}*`,
      "COUNT",
      100,
    );
    cursor = nextCursor;

    for (const key of keys) {
      const symbol = key.slice(desiredSymbolLeasePrefix.length);

      if (symbol) {
        symbols.add(symbol);
      }
    }
  } while (cursor !== "0");

  return Array.from(symbols);
}

export async function getCachedSnapshot(redis: Redis, symbol: string, staleAfterMs: number) {
  const cached = parseCachedSnapshot(await redis.get(snapshotKey(symbol)));

  if (!cached) {
    return null;
  }

  return toPublicSnapshot(cached, {
    staleAfterMs,
    source: "redis_cache",
  });
}

export async function publishSnapshot(redis: Redis, snapshot: CachedPriceSnapshot) {
  const message: PriceMessage = {
    type: "price",
    data: toPublicSnapshot(snapshot, {
      staleAfterMs: Number.POSITIVE_INFINITY,
    }),
  };

  const payload = JSON.stringify(snapshot);

  await redis
    .pipeline()
    .set(snapshotKey(snapshot.symbol), payload, "EX", snapshotTtlSeconds)
    .publish(marketDataChannels.ticks, JSON.stringify(message))
    .exec();
}
