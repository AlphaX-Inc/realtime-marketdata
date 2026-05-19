export type MarketState = "regular" | "pre" | "post" | "closed";

export type PriceSource = "websocket" | "quote_api" | "redis_cache";

export type PriceSnapshot = {
  symbol: string;
  price: string;
  open: string | null;
  high: string | null;
  low: string | null;
  close: string | null;
  previousClose: string | null;
  change: string | null;
  percentChange: string | null;
  volume: string | null;
  timestamp: number;
  marketState: MarketState;
  source: PriceSource;
  stale: boolean;
};

export type CachedPriceSnapshot = PriceSnapshot & {
  receivedAt: number;
};

export type PriceMessage = {
  type: "price";
  data: PriceSnapshot;
};

export type ErrorMessage = {
  type: "error";
  message: string;
};

export type ServerMessage = PriceMessage | ErrorMessage;

export type ClientSubscriptionMessage = {
  type: "subscribe" | "unsubscribe";
  symbols: string[];
};

export type MarketDataCommand = {
  type: "subscribe" | "unsubscribe" | "refresh";
  symbols: string[];
  timestamp: number;
};

export type TwelveDataPriceEvent = {
  event?: string;
  symbol?: string;
  price?: string | number;
  timestamp?: number;
};

export type TwelveDataQuote = {
  symbol?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  previous_close?: string;
  change?: string;
  percent_change?: string;
  volume?: string;
  timestamp?: number;
  is_market_open?: boolean;
  extended_price?: string;
  extended_change?: string;
  extended_percent_change?: string;
  extended_timestamp?: number;
};
