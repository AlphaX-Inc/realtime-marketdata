import WebSocket from "ws";
import { twelveDataApiKey, twelveDataWsUrl } from "../config.js";
import type { TwelveDataPriceEvent } from "../market-data/types.js";

type TwelveDataWsOptions = {
  onPrice: (
    event: Required<Pick<TwelveDataPriceEvent, "symbol" | "price">> &
      Pick<TwelveDataPriceEvent, "timestamp">,
  ) => void;
  onStatus?: (status: {
    eventType: string;
    message: string;
    symbols?: string[];
    metadata?: Record<string, string | number | boolean | null>;
  }) => void;
};

const heartbeatIntervalMs = 10_000;
const reconnectInitialDelayMs = 1_000;
const reconnectMaxDelayMs = 30_000;

export class TwelveDataWsClient {
  private readonly subscribedSymbols = new Set<string>();
  private ws: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectDelayMs = reconnectInitialDelayMs;
  private shouldReconnect = true;

  constructor(private readonly options: TwelveDataWsOptions) {}

  connect() {
    if (!twelveDataApiKey) {
      throw new Error("TWELVEDATA_API_KEY is required for the Twelve Data WebSocket");
    }

    this.shouldReconnect = true;
    this.open();
  }

  subscribe(symbols: string[]) {
    const newSymbols = symbols.filter((symbol) => !this.subscribedSymbols.has(symbol));

    if (newSymbols.length === 0) {
      return;
    }

    for (const symbol of newSymbols) {
      this.subscribedSymbols.add(symbol);
    }

    this.sendAction("subscribe", newSymbols);
  }

  unsubscribe(symbols: string[]) {
    const removedSymbols = symbols.filter((symbol) => this.subscribedSymbols.delete(symbol));

    if (removedSymbols.length === 0) {
      return;
    }

    this.sendAction("unsubscribe", removedSymbols);
  }

  close() {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
  }

  private open() {
    const url = new URL(twelveDataWsUrl);
    url.searchParams.set("apikey", twelveDataApiKey ?? "");

    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      this.reconnectDelayMs = reconnectInitialDelayMs;
      this.options.onStatus?.({
        eventType: "connected",
        message: "Twelve Data WebSocket connected",
      });
      this.startHeartbeat();

      if (this.subscribedSymbols.size > 0) {
        const symbols = Array.from(this.subscribedSymbols);
        this.options.onStatus?.({
          eventType: "resubscribe",
          message: "Resubscribed active symbols after reconnect",
          symbols,
        });
        this.sendAction("subscribe", symbols);
      }
    });

    this.ws.on("message", (raw) => {
      this.handleMessage(raw.toString());
    });

    this.ws.on("close", () => {
      this.options.onStatus?.({
        eventType: "closed",
        message: "Twelve Data WebSocket closed",
      });
      this.stopHeartbeat();
      this.scheduleReconnect();
    });

    this.ws.on("error", (error) => {
      this.options.onStatus?.({
        eventType: "error",
        message: "Twelve Data WebSocket error",
        metadata: {
          error: error.message,
        },
      });
    });
  }

  private handleMessage(raw: string) {
    let parsed: TwelveDataPriceEvent;

    try {
      parsed = JSON.parse(raw) as TwelveDataPriceEvent;
    } catch {
      return;
    }

    if (parsed.event !== "price" || !parsed.symbol || parsed.price === undefined) {
      return;
    }

    this.options.onPrice({
      symbol: parsed.symbol.toUpperCase(),
      price: parsed.price,
      timestamp: parsed.timestamp,
    });
  }

  private sendAction(action: "subscribe" | "unsubscribe", symbols: string[]) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(
      JSON.stringify({
        action,
        params: {
          symbols: symbols.join(","),
        },
      }),
    );
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: "heartbeat" }));
      }
    }, heartbeatIntervalMs);
    this.heartbeatTimer.unref();
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect) {
      return;
    }

    const delay = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, reconnectMaxDelayMs);
    this.options.onStatus?.({
      eventType: "reconnect",
      message: "Scheduled Twelve Data WebSocket reconnect",
      metadata: {
        delayMs: delay,
      },
    });

    setTimeout(() => {
      if (this.shouldReconnect) {
        this.open();
      }
    }, delay).unref();
  }
}
