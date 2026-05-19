import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@realtime-pricing/ui/components/card";
import { CodeBlock } from "@realtime-pricing/ui/components/code-block";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderTitle,
} from "@realtime-pricing/ui/components/page-header";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/docs")({
  component: DocsPage,
});

const fields = [
  ["symbol", "Normalized uppercase ticker requested by the client."],
  [
    "price",
    "Primary display price selected by market state: WebSocket tick during regular hours, Quote API extended price during pre/post-market, and Quote API close when closed.",
  ],
  ["open, high, low, close", "OHLC fields from the Quote API snapshot."],
  ["previousClose", "Previous regular-session close from the Quote API."],
  ["change, percentChange", "Change values from the Quote API for the active price context."],
  ["volume", "Latest Quote API volume when available."],
  [
    "timestamp",
    "Unix timestamp from the selected price source; pre/post-market uses extended_timestamp when available.",
  ],
  ["marketState", "One of pre, regular, post, or closed."],
  [
    "source",
    "websocket for regular-session live ticks, quote_api for Quote API snapshots, and redis_cache when an existing snapshot is returned immediately on subscribe.",
  ],
  ["stale", "true when the returned cached snapshot is older than the configured stale window."],
] as const;

const marketStates = [
  ["pre", "04:00-09:30 America/New_York", "price uses Quote API extended_price when present."],
  [
    "regular",
    "09:30-16:00 America/New_York",
    "price uses live Twelve Data WebSocket ticks; OHLC fields come from the latest Quote API snapshot.",
  ],
  ["post", "16:00-20:00 America/New_York", "price uses Quote API extended_price when present."],
  [
    "closed",
    "Weekends and outside the above windows",
    "price uses Quote API close, falling back to previousClose.",
  ],
] as const;

type DocsTab = "docs" | "consumer";

const tabs = [
  ["docs", "Docs"],
  ["consumer", "Consumer"],
] as const satisfies readonly [DocsTab, string][];

function DocsPage() {
  const [activeTab, setActiveTab] = useState<DocsTab>("docs");

  return (
    <div className="grid gap-5">
      <PageHeader>
        <PageHeaderEyebrow>Market data gateway</PageHeaderEyebrow>
        <PageHeaderTitle>Docs</PageHeaderTitle>
        <PageHeaderDescription>
          How internal services subscribe to realtime US stock prices through the single gateway
          endpoint.
        </PageHeaderDescription>
      </PageHeader>

      <div
        aria-label="Docs sections"
        className="inline-flex w-fit rounded-lg border border-border/70 bg-card/70 p-1"
        role="tablist"
      >
        {tabs.map(([tab, label]) => (
          <button
            aria-selected={activeTab === tab}
            className={
              activeTab === tab
                ? "rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white"
                : "rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-zinc-950"
            }
            key={tab}
            onClick={() => setActiveTab(tab)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className={activeTab === "docs" ? "grid gap-5" : "hidden"} role="tabpanel">
        <Card>
          <CardHeader>
            <CardTitle>Connection</CardTitle>
            <CardDescription>
              Connect services to this app only. The gateway owns the upstream Twelve Data
              connection.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-lg border border-primary/15 bg-accent/45 px-4 py-3 text-sm leading-6 text-zinc-700">
              Generate a service key from{" "}
              <span className="font-semibold text-zinc-950">API keys</span>, then connect to the
              gateway below using your deployment&apos;s WebSocket origin, domain, reverse-proxy
              alias, or service alias. Backend services should send the key in a header;
              query-string auth is only for WebSocket clients that cannot send headers.
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-border/70 bg-card/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">Backend services</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Preferred: keep the key out of URLs and logs.
                    </p>
                  </div>
                  <span className="rounded-[0.3rem] bg-primary/10 px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-primary">
                    Recommended
                  </span>
                </div>
                <CodeBlock className="mt-3">
                  <code>{`<gateway-ws-origin>/ws/prices
x-api-key: <api-key>`}</code>
                </CodeBlock>
              </div>

              <div className="rounded-lg border border-border/70 bg-card/70 p-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-950">Browser or limited clients</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Use only when the client cannot attach headers.
                  </p>
                </div>
                <CodeBlock className="mt-3">
                  <code>{`<gateway-ws-origin>/ws/prices?api_key=<api-key>`}</code>
                </CodeBlock>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Under the hood</CardTitle>
            <CardDescription>
              Which Twelve Data source is used for each market window.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="overflow-hidden rounded-lg border border-border/70 bg-card/80">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/70 text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Market window</th>
                    <th className="px-4 py-3 font-medium">Twelve Data source</th>
                    <th className="px-4 py-3 font-medium">Price used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-950">Regular</td>
                    <td className="px-4 py-3">WebSocket price stream</td>
                    <td className="px-4 py-3">Live tick price</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-950">Pre / Post</td>
                    <td className="px-4 py-3">Quote API</td>
                    <td className="px-4 py-3">Extended-hours price</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-950">Closed</td>
                    <td className="px-4 py-3">Quote API</td>
                    <td className="px-4 py-3">Closing price</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground">
              Consumers still connect to the same `/ws/prices` endpoint for every window.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parameters</CardTitle>
            <CardDescription>
              Client messages use JSON and only need a type plus symbols.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="overflow-hidden rounded-lg border border-border/70 bg-card/80">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/70 text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Field</th>
                    <th className="px-4 py-3 font-medium">Required</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs">type</td>
                    <td className="px-4 py-3">Yes</td>
                    <td className="px-4 py-3">`subscribe` or `unsubscribe`.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs">symbols</td>
                    <td className="px-4 py-3">Yes</td>
                    <td className="px-4 py-3">
                      Array of US stock tickers. Values are trimmed, uppercased, deduplicated, and
                      invalid symbols are ignored.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <CodeBlock>
              <code>{`{
  "type": "subscribe",
  "symbols": ["AAPL", "MSFT"]
}`}</code>
            </CodeBlock>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unsubscribe</CardTitle>
            <CardDescription>
              Use this only when keeping the socket open but stopping specific symbols.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-zinc-700">
              If the socket closes, the gateway automatically removes all subscriptions for that
              client. Upstream unsubscribe happens after a short grace period if no other client
              still needs the symbol.
            </p>
            <CodeBlock>
              <code>{`{
  "type": "unsubscribe",
  "symbols": ["AAPL"]
}`}</code>
            </CodeBlock>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Multiple ticker response</CardTitle>
            <CardDescription>
              The server sends one `price` message per symbol, not one combined batch response.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock>
              <code>{`// Client sends one subscribe request:
{
  "type": "subscribe",
  "symbols": ["AAPL", "MSFT"]
}

// Server streams independent messages as data arrives:
{
  "type": "price",
  "data": {
    "symbol": "AAPL",
    "price": "191.25",
    "open": "188.00",
    "high": "191.00",
    "low": "187.50",
    "close": "189.50",
    "previousClose": "187.20",
    "change": "2.30",
    "percentChange": "1.22",
    "volume": "12345678",
    "timestamp": 1760000200,
    "marketState": "regular",
    "source": "websocket",
    "stale": false
  }
}

{
  "type": "price",
  "data": {
    "symbol": "MSFT",
    "price": "430.44",
    "open": "428.10",
    "high": "431.20",
    "low": "426.90",
    "close": "427.80",
    "previousClose": "426.30",
    "change": "4.14",
    "percentChange": "0.97",
    "volume": "18500321",
    "timestamp": 1760000002,
    "marketState": "regular",
    "source": "websocket",
    "stale": false
  }
}`}</code>
            </CodeBlock>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Market states and price selection</CardTitle>
            <CardDescription>
              `price` is the primary price your service should display. Its source changes by market
              state.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="overflow-hidden rounded-lg border border-border/70 bg-card/80">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/70 text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">State</th>
                    <th className="px-4 py-3 font-medium">Window</th>
                    <th className="px-4 py-3 font-medium">Price behavior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {marketStates.map(([state, window, behavior]) => (
                    <tr key={state}>
                      <td className="px-4 py-3 font-mono text-xs">{state}</td>
                      <td className="px-4 py-3">{window}</td>
                      <td className="px-4 py-3">{behavior}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-zinc-700">
              Market state is evaluated in the US Eastern timezone. Pre-market and post-market are
              extended-hours sessions, so the primary price is still the `price` field, populated
              from Twelve Data `extended_price` when available. Quote API snapshots are polled by
              the worker at the configured interval.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Price payload fields</CardTitle>
            <CardDescription>
              Field meanings for every `type: "price"` server message.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-border/70 bg-card/80">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/70 text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Field</th>
                    <th className="px-4 py-3 font-medium">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {fields.map(([field, meaning]) => (
                    <tr key={field}>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{field}</td>
                      <td className="px-4 py-3">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error messages</CardTitle>
            <CardDescription>
              The server sends an error message when the client sends an invalid command.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock>
              <code>{`{
  "type": "error",
  "message": "Expected { type: 'subscribe' | 'unsubscribe', symbols: string[] }"
}`}</code>
            </CodeBlock>
          </CardContent>
        </Card>
      </div>

      <div className={activeTab === "consumer" ? "grid gap-5" : "hidden"} role="tabpanel">
        <Card>
          <CardHeader>
            <CardTitle>JavaScript consumer</CardTitle>
            <CardDescription>
              Browser clients can derive the WebSocket URL from the current page origin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock>
              <code>{`const apiKey = "<api-key>";
const wsUrl = new URL("/ws/prices", window.location.href);

wsUrl.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
wsUrl.searchParams.set("api_key", apiKey);

const socket = new WebSocket(wsUrl.toString());

socket.addEventListener("open", () => {
  socket.send(JSON.stringify({
    type: "subscribe",
    symbols: ["AAPL", "MSFT"],
  }));
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);

  if (message.type === "price") {
    console.log(message.data.symbol, message.data.price);
  }
});`}</code>
            </CodeBlock>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>React consumer</CardTitle>
            <CardDescription>
              Keep one socket open, subscribe on connect, and update state from `price` messages.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock>
              <code>{`import { useEffect, useState } from "react";

type Price = {
  symbol: string;
  price: string;
  marketState: "pre" | "regular" | "post" | "closed";
  source: "websocket" | "quote_api" | "redis_cache";
};

export function PriceTicker() {
  const [prices, setPrices] = useState<Record<string, Price>>({});

  useEffect(() => {
    const wsUrl = new URL("/ws/prices", window.location.href);

    wsUrl.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    wsUrl.searchParams.set("api_key", "<api-key>");

    const socket = new WebSocket(wsUrl.toString());

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({
        type: "subscribe",
        symbols: ["AAPL", "MSFT"],
      }));
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);

      if (message.type !== "price") {
        return;
      }

      setPrices((current) => ({
        ...current,
        [message.data.symbol]: message.data,
      }));
    });

    return () => socket.close();
  }, []);

  return (
    <ul>
      {Object.values(prices).map((price) => (
        <li key={price.symbol}>
          {price.symbol}: {price.price}
        </li>
      ))}
    </ul>
  );
}`}</code>
            </CodeBlock>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
