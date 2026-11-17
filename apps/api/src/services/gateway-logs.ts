import { db, type Prisma } from "../db.js";

export type GatewayLogSource = "downstream" | "upstream" | "bigdata";

export type GatewayLogInput = {
  source: GatewayLogSource;
  eventType: string;
  message: string;
  serviceApiKeyId?: string | null;
  serviceApiKeyName?: string | null;
  symbols?: string[];
  metadata?: Prisma.InputJsonObject;
};

const retentionMs = 7 * 24 * 60 * 60 * 1000;
let nextCleanupAt = 0;

function warnLogFailure(error: unknown) {
  console.warn("Gateway log write failed", error instanceof Error ? error.message : error);
}

function cleanupExpiredLogs() {
  const now = Date.now();

  if (now < nextCleanupAt) {
    return;
  }

  nextCleanupAt = now + 60 * 60 * 1000;

  void db.gatewayLog
    .deleteMany({
      where: {
        createdAt: {
          lt: new Date(now - retentionMs),
        },
      },
    })
    .catch(warnLogFailure);
}

export function recordGatewayLog(input: GatewayLogInput) {
  void db.gatewayLog
    .create({
      data: {
        source: input.source,
        eventType: input.eventType,
        serviceApiKeyId: input.serviceApiKeyId ?? null,
        serviceApiKeyName: input.serviceApiKeyName ?? null,
        symbols: input.symbols ?? [],
        message: input.message,
        metadata: input.metadata ?? {},
      },
    })
    .then(() => cleanupExpiredLogs())
    .catch(warnLogFailure);
}

export function normalizeLogLimit(rawLimit: string | undefined) {
  const limit = Number(rawLimit ?? 100);

  if (!Number.isFinite(limit)) {
    return 100;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 500);
}

export async function listGatewayLogs(limit: number, where?: Prisma.GatewayLogWhereInput) {
  const logs = await db.gatewayLog.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return logs.map((log) => ({
    id: log.id,
    source: log.source,
    eventType: log.eventType,
    serviceApiKeyId: log.serviceApiKeyId,
    serviceApiKeyName: log.serviceApiKeyName,
    symbols: log.symbols,
    message: log.message,
    metadata: log.metadata,
    createdAt: log.createdAt.toISOString(),
  }));
}

export type BigdataToolStats = {
  tool: string;
  calls: number;
  hits: number;
  misses: number;
  bypassed: number;
  errors: number;
  avgDurationMs: number;
};

// Per-tool rollup of proxied Bigdata MCP calls; ::int casts keep BigInt/Decimal out of the JSON.
export function summarizeBigdataCalls(since: Date) {
  return db.$queryRaw<BigdataToolStats[]>`
    SELECT metadata->>'tool' AS tool,
           count(*)::int AS calls,
           count(*) FILTER (WHERE metadata->>'cache' = 'HIT')::int AS hits,
           count(*) FILTER (WHERE metadata->>'cache' = 'MISS')::int AS misses,
           count(*) FILTER (WHERE metadata->>'cache' = 'BYPASS')::int AS bypassed,
           count(*) FILTER (WHERE (metadata->>'error')::boolean)::int AS errors,
           round(avg((metadata->>'durationMs')::numeric))::int AS "avgDurationMs"
    FROM "GatewayLog"
    WHERE source = 'bigdata' AND "createdAt" > ${since}
    GROUP BY 1
    ORDER BY calls DESC
  `;
}

const cacheTtlMs = 24 * 60 * 60 * 1000;

export type MissReason = "new" | "prev_failed" | "expired" | "concurrent" | "cache_lost";

type MissContext = {
  cache: unknown;
  key: unknown;
  durationMs: unknown;
  createdAt: Date;
  prevAt: Date | null;
  lastStoredAt: Date | null;
};

// Why a MISS wasn't served from cache, from earlier calls with the same tool + cache key.
export function missReason(call: MissContext): MissReason | null {
  if (call.cache !== "MISS" || typeof call.key !== "string") {
    return null;
  }

  if (!call.lastStoredAt) {
    return call.prevAt ? "prev_failed" : "new";
  }

  // HITs don't refresh the TTL, so age is measured from the last successful store.
  const sinceStored = call.createdAt.getTime() - call.lastStoredAt.getTime();

  if (sinceStored > cacheTtlMs) {
    return "expired";
  }

  // The store landed after this call had already started.
  return sinceStored < Number(call.durationMs ?? 0) ? "concurrent" : "cache_lost";
}

type BigdataCallRow = {
  id: string;
  metadata: Prisma.JsonObject;
  createdAt: Date;
  prevAt: Date | null;
  lastStoredAt: Date | null;
};

export async function listBigdataCalls(limit: number) {
  // ponytail: window runs over all 7 days of bigdata rows before LIMIT; bound the scan or index (source, createdAt) if slow
  const rows = await db.$queryRaw<BigdataCallRow[]>`
    SELECT id, metadata, "createdAt",
           lag("createdAt") OVER w AS "prevAt",
           max("createdAt") FILTER (
             WHERE metadata->>'cache' = 'MISS' AND metadata->>'error' = 'false'
           ) OVER w AS "lastStoredAt"
    FROM "GatewayLog"
    WHERE source = 'bigdata'
    WINDOW w AS (
      PARTITION BY metadata->>'tool', metadata->>'key'
      ORDER BY "createdAt"
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    )
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    id: row.id,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    missReason: missReason({
      cache: row.metadata.cache,
      key: row.metadata.key,
      durationMs: row.metadata.durationMs,
      createdAt: row.createdAt,
      prevAt: row.prevAt,
      lastStoredAt: row.lastStoredAt,
    }),
  }));
}
