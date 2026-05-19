import { quoteClosedPollIntervalMs, quotePollIntervalMs, redisUrl } from "../config.js";
import {
  createRedisClient,
  listDesiredSymbols,
  publishSnapshot,
} from "../market-data/redis-bus.js";
import { marketDataChannels } from "../market-data/redis-keys.js";
import { buildSnapshotFromQuote, mergeTickWithQuote } from "../market-data/snapshots.js";
import type {
  MarketDataCommand,
  TwelveDataPriceEvent,
  TwelveDataQuote,
} from "../market-data/types.js";
import { getUsMarketState } from "../market-hours/us-market-hours.js";
import { recordGatewayLog } from "../services/gateway-logs.js";
import { fetchQuote } from "./twelvedata-quote.js";
import { TwelveDataWsClient } from "./twelvedata-ws.js";

const reconcileIntervalMs = 2_000;
const quoteLoopIntervalMs = 5_000;
const unsubscribeGraceMs = 30_000;

type LatestTick = Required<Pick<TwelveDataPriceEvent, "symbol" | "price">> &
  Pick<TwelveDataPriceEvent, "timestamp">;

export class MarketDataWorker {
  private readonly redis = createRedisClient(redisUrl);
  private readonly subscriber = createRedisClient(redisUrl);
  private readonly desiredSymbols = new Set<string>();
  private readonly quoteCache = new Map<string, TwelveDataQuote>();
  private readonly latestTicks = new Map<string, LatestTick>();
  private readonly nextQuotePollAt = new Map<string, number>();
  private readonly unsubscribeTimers = new Map<string, NodeJS.Timeout>();
  private readonly upstream = new TwelveDataWsClient({
    onPrice: (event) => void this.handlePriceTick(event),
    onStatus: (status) => {
      console.log(status.message);
      recordGatewayLog({
        source: "upstream",
        eventType: status.eventType,
        message: status.message,
        symbols: status.symbols,
        metadata: status.metadata,
      });
    },
  });

  async start() {
    await this.subscriber.subscribe(marketDataChannels.commands);
    this.subscriber.on("message", (_channel: string, raw: string) => {
      void this.handleCommand(raw);
    });

    await this.reconcileDesiredSymbols();
    this.upstream.connect();

    setInterval(() => {
      void this.reconcileDesiredSymbols();
    }, reconcileIntervalMs).unref();

    setInterval(() => {
      void this.pollDueQuotes();
    }, quoteLoopIntervalMs).unref();

    console.log("Market data worker started");
  }

  async stop() {
    this.upstream.close();
    await this.subscriber.quit();
    await this.redis.quit();
  }

  private async handleCommand(raw: string) {
    let command: MarketDataCommand;

    try {
      command = JSON.parse(raw) as MarketDataCommand;
    } catch {
      return;
    }

    if (!Array.isArray(command.symbols)) {
      return;
    }

    await this.reconcileDesiredSymbols();
  }

  private async reconcileDesiredSymbols() {
    const symbols = await listDesiredSymbols(this.redis);
    const desired = new Set(symbols);

    for (const symbol of desired) {
      this.cancelPendingUnsubscribe(symbol);

      if (!this.desiredSymbols.has(symbol)) {
        this.desiredSymbols.add(symbol);
        this.upstream.subscribe([symbol]);
        this.nextQuotePollAt.set(symbol, 0);
      }
    }

    for (const symbol of Array.from(this.desiredSymbols)) {
      if (!desired.has(symbol)) {
        this.scheduleUnsubscribe(symbol);
      }
    }
  }

  private scheduleUnsubscribe(symbol: string) {
    if (this.unsubscribeTimers.has(symbol)) {
      return;
    }

    const timer = setTimeout(() => {
      this.desiredSymbols.delete(symbol);
      this.quoteCache.delete(symbol);
      this.latestTicks.delete(symbol);
      this.nextQuotePollAt.delete(symbol);
      this.unsubscribeTimers.delete(symbol);
      this.upstream.unsubscribe([symbol]);
    }, unsubscribeGraceMs);

    timer.unref();
    this.unsubscribeTimers.set(symbol, timer);
  }

  private cancelPendingUnsubscribe(symbol: string) {
    const timer = this.unsubscribeTimers.get(symbol);

    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.unsubscribeTimers.delete(symbol);
  }

  private async handlePriceTick(tick: LatestTick) {
    if (!this.desiredSymbols.has(tick.symbol)) {
      return;
    }

    const marketState = getUsMarketState();

    if (marketState !== "regular") {
      return;
    }

    this.latestTicks.set(tick.symbol, tick);
    const snapshot = mergeTickWithQuote(tick, this.quoteCache.get(tick.symbol), marketState);
    await publishSnapshot(this.redis, snapshot);
  }

  private async pollDueQuotes() {
    const now = Date.now();
    const marketState = getUsMarketState();
    const interval = marketState === "closed" ? quoteClosedPollIntervalMs : quotePollIntervalMs;

    await Promise.all(
      Array.from(this.desiredSymbols).map(async (symbol) => {
        const nextPollAt = this.nextQuotePollAt.get(symbol) ?? 0;

        if (now < nextPollAt) {
          return;
        }

        this.nextQuotePollAt.set(symbol, now + interval);

        try {
          const quote = await fetchQuote(symbol);
          this.quoteCache.set(symbol, quote);

          const latestTick = this.latestTicks.get(symbol);
          const snapshot = buildSnapshotFromQuote(symbol, quote, marketState, {
            latestTickPrice: marketState === "regular" ? latestTick?.price.toString() : undefined,
            latestTickTimestamp: marketState === "regular" ? latestTick?.timestamp : undefined,
          });

          if (snapshot) {
            if (marketState === "regular" && latestTick) {
              snapshot.source = "websocket";
            }

            await publishSnapshot(this.redis, snapshot);
          }
        } catch (error) {
          console.error(error instanceof Error ? error.message : error);
        }
      }),
    );
  }
}
