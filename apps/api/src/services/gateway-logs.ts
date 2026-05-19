import { db, type Prisma } from "../db.js";

export type GatewayLogSource = "downstream" | "upstream";

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

export async function listGatewayLogs(limit: number) {
  const logs = await db.gatewayLog.findMany({
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
