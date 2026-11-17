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
