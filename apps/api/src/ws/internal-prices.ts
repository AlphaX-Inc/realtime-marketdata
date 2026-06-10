import { randomUUID } from "node:crypto";
import type { UpgradeWebSocket, WSContext } from "hono/ws";
import type { WebSocket } from "ws";
import { redisUrl, staleAfterMs } from "../config.js";
import {
  createRedisClient,
  getCachedSnapshot,
  publishCommand,
  refreshDesiredSymbolLeases,
  removeDesiredSymbolLeases,
} from "../market-data/redis-bus.js";
import { marketDataChannels } from "../market-data/redis-keys.js";
import { SubscriptionRegistry } from "../market-data/subscription-registry.js";
import { normalizeSymbols } from "../market-data/symbols.js";
import type {
  ClientSubscriptionMessage,
  ErrorMessage,
  PriceMessage,
  ServerMessage,
} from "../market-data/types.js";
import { recordGatewayLog } from "../services/gateway-logs.js";
import type { ValidatedServiceApiKey } from "../services/service-api-keys.js";

type ClientSocket = WSContext<WebSocket>;

const leaseRefreshIntervalMs = 5_000;

function sendJson(ws: ClientSocket, message: ServerMessage) {
  if (ws.readyState !== 1) {
    return;
  }

  ws.send(JSON.stringify(message));
}

function parseClientMessage(raw: unknown): ClientSubscriptionMessage | null {
  if (typeof raw !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ClientSubscriptionMessage;

    if (
      (parsed.type === "subscribe" || parsed.type === "unsubscribe") &&
      Array.isArray(parsed.symbols)
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export function createInternalPricesGateway(upgradeWebSocket: UpgradeWebSocket<WebSocket>) {
  const redis = createRedisClient(redisUrl);
  const subscriber = createRedisClient(redisUrl);
  const registry = new SubscriptionRegistry<string>();
  const clients = new Map<string, ClientSocket>();

  void subscriber.subscribe(marketDataChannels.ticks);
  subscriber.on("message", (_channel: string, raw: string) => {
    let message: PriceMessage;

    try {
      message = JSON.parse(raw) as PriceMessage;
    } catch {
      return;
    }

    if (message.type !== "price") {
      return;
    }

    const clientIds = registry.clientsForSymbol(message.data.symbol);

    for (const clientId of clientIds) {
      const client = clients.get(clientId);

      if (client) {
        sendJson(client, message);
      }
    }
  });

  setInterval(() => {
    void refreshDesiredSymbolLeases(redis, registry.activeSymbols());
  }, leaseRefreshIntervalMs).unref();

  return upgradeWebSocket((c) => {
    const clientId = randomUUID();
    const serviceApiKey = c.get("serviceApiKey") as ValidatedServiceApiKey | undefined;

    const logDownstream = (eventType: string, message: string, symbols: string[] = []) => {
      recordGatewayLog({
        source: "downstream",
        eventType,
        message,
        serviceApiKeyId: serviceApiKey?.id ?? null,
        serviceApiKeyName: serviceApiKey?.name ?? null,
        symbols,
        metadata: {
          clientId,
        },
      });
    };

    return {
      onOpen: (_event, ws) => {
        clients.set(clientId, ws);
        registry.addClient(clientId);
        logDownstream("connected", "Connected WebSocket client");
      },
      onMessage: (event, ws) => {
        void (async () => {
          const message = parseClientMessage(event.data);

          if (!message) {
            sendJson(ws, {
              type: "error",
              message: "Expected { type: 'subscribe' | 'unsubscribe', symbols: string[] }",
            } satisfies ErrorMessage);
            return;
          }

          const symbols = normalizeSymbols(message.symbols);

          if (symbols.length === 0) {
            sendJson(ws, {
              type: "error",
              message: "At least one valid market symbol is required",
            } satisfies ErrorMessage);
            return;
          }

          if (message.type === "subscribe") {
            const newlyActiveSymbols = registry.subscribe(clientId, symbols);
            logDownstream("subscribe", "Subscribed to symbols", symbols);

            await refreshDesiredSymbolLeases(redis, registry.activeSymbols());

            if (newlyActiveSymbols.length > 0) {
              await publishCommand(redis, {
                type: "subscribe",
                symbols: newlyActiveSymbols,
                timestamp: Date.now(),
              });
            }

            const cachedSnapshots = await Promise.all(
              symbols.map((symbol) => getCachedSnapshot(redis, symbol, staleAfterMs)),
            );

            for (const snapshot of cachedSnapshots) {
              if (snapshot) {
                sendJson(ws, {
                  type: "price",
                  data: snapshot,
                });
              }
            }

            return;
          }

          const newlyInactiveSymbols = registry.unsubscribe(clientId, symbols);
          logDownstream("unsubscribe", "Unsubscribed from symbols", symbols);

          if (newlyInactiveSymbols.length > 0) {
            await removeDesiredSymbolLeases(redis, newlyInactiveSymbols);
            await publishCommand(redis, {
              type: "unsubscribe",
              symbols: newlyInactiveSymbols,
              timestamp: Date.now(),
            });
          }
        })();
      },
      onClose: () => {
        const symbols = Array.from(registry.symbolsForClient(clientId));
        logDownstream("disconnected", "Disconnected WebSocket client", symbols);
        clients.delete(clientId);
        const inactiveSymbols = registry.removeClient(clientId);

        if (inactiveSymbols.length > 0) {
          void removeDesiredSymbolLeases(redis, inactiveSymbols);
          void publishCommand(redis, {
            type: "unsubscribe",
            symbols: inactiveSymbols,
            timestamp: Date.now(),
          });
        }
      },
      onError: () => {
        const symbols = Array.from(registry.symbolsForClient(clientId));
        logDownstream("error", "WebSocket client error", symbols);
        clients.delete(clientId);
        const inactiveSymbols = registry.removeClient(clientId);

        if (inactiveSymbols.length > 0) {
          void removeDesiredSymbolLeases(redis, inactiveSymbols);
          void publishCommand(redis, {
            type: "unsubscribe",
            symbols: inactiveSymbols,
            timestamp: Date.now(),
          });
        }
      },
    };
  });
}
