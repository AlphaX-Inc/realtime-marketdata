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

type DocsTab = "reference" | "consumer";

const tabs = [
  ["reference", "Reference"],
  ["consumer", "Consumer"],
] as const satisfies readonly [DocsTab, string][];

const snapshotFields = [
  ["symbol", "Canonical symbol returned by the gateway, for example AAPL or TSE:7203."],
  ["price", "Primary display price selected by the gateway."],
  ["open, high, low, close", "OHLC fields from the latest quote or daily bar."],
  ["previousClose", "Previous close when enough upstream data is available."],
  ["change, percentChange", "Computed or upstream-provided change values."],
  ["volume", "Quote or daily bar volume when available."],
  ["timestamp", "Unix timestamp for the selected source data."],
  ["marketState", "pre, regular, post, or closed."],
  ["source", "websocket, quote_api, jquants_daily, alphavantage_daily, or redis_cache."],
  ["provider", "twelvedata, jquants, or alphavantage."],
  ["stale", "true when an immediate cached snapshot is older than the stale window."],
] as const;

function DocsPage() {
  const [activeTab, setActiveTab] = useState<DocsTab>("reference");

  return (
    <div className="grid gap-5">
      <PageHeader>
        <PageHeaderEyebrow>Market data gateway</PageHeaderEyebrow>
        <PageHeaderTitle>Docs</PageHeaderTitle>
        <PageHeaderDescription>
          One internal gateway for live price snapshots, daily OHLC, and options chains.
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

      <div className={activeTab === "reference" ? "grid gap-5" : "hidden"} role="tabpanel">
        <Card>
          <CardHeader>
            <CardTitle>What to use</CardTitle>
            <CardDescription>Pick the endpoint by workflow, not by provider.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-border/70 bg-card/80">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/70 text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Need</th>
                    <th className="px-4 py-3 font-medium">Endpoint</th>
                    <th className="px-4 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-950">Latest prices</td>
                    <td className="px-4 py-3 font-mono text-xs">/ws/prices</td>
                    <td className="px-4 py-3">WebSocket stream of normalized `price` messages.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-950">Historical OHLC</td>
                    <td className="px-4 py-3 font-mono text-xs">/daily-ohlc</td>
                    <td className="px-4 py-3">REST date-range query for US and TSE symbols.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-950">Options chains</td>
                    <td className="px-4 py-3 font-mono text-xs">/options</td>
                    <td className="px-4 py-3">REST query for US Alpha Vantage or JP J-Quants.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>
              Use a service API key from the API keys page. WebSocket browser clients can pass it in
              the query string.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-card/70 p-4">
              <p className="text-sm font-semibold text-zinc-950">HTTP endpoints</p>
              <CodeBlock className="mt-3">
                <code>{`x-api-key: <api-key>`}</code>
              </CodeBlock>
            </div>
            <div className="rounded-lg border border-border/70 bg-card/70 p-4">
              <p className="text-sm font-semibold text-zinc-950">Browser WebSocket</p>
              <CodeBlock className="mt-3">
                <code>{`ws://localhost:3000/ws/prices?api_key=<api-key>`}</code>
              </CodeBlock>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Symbols</CardTitle>
            <CardDescription>Use canonical symbols where possible.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-border/70 bg-card/80">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/70 text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Market</th>
                    <th className="px-4 py-3 font-medium">Accepted input</th>
                    <th className="px-4 py-3 font-medium">Canonical output</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-950">US equity</td>
                    <td className="px-4 py-3 font-mono text-xs">AAPL, MSFT, NVDA</td>
                    <td className="px-4 py-3 font-mono text-xs">AAPL</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-950">TSE equity</td>
                    <td className="px-4 py-3 font-mono text-xs">TSE:7203, 7203.T, 72030.T</td>
                    <td className="px-4 py-3 font-mono text-xs">TSE:7203</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>WebSocket latest prices</CardTitle>
            <CardDescription>
              Subscribe once; the server sends one `price` message per symbol.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <CodeBlock>
              <code>{`// Client -> server
{
  "type": "subscribe",
  "symbols": ["AAPL", "TSE:7203"]
}

// Server -> client
{
  "type": "price",
  "data": {
    "symbol": "TSE:7203",
    "price": "2814",
    "open": "2840",
    "high": "2851",
    "low": "2795",
    "close": "2814",
    "previousClose": "2806",
    "change": "8",
    "percentChange": "0.28510335",
    "volume": "12345600",
    "timestamp": 1764514800,
    "marketState": "closed",
    "source": "jquants_daily",
    "provider": "jquants",
    "stale": false
  }
}`}</code>
            </CodeBlock>
            <p className="text-sm leading-6 text-zinc-700">
              US symbols use Twelve Data realtime ticks during regular hours. TSE symbols are
              REST-polled from J-Quants only while subscribed, then delivered through the same
              WebSocket shape.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily OHLC</CardTitle>
            <CardDescription>
              Use REST when you need a date range instead of latest snapshots.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <CodeBlock>
              <code>{`GET /daily-ohlc?symbol=TSE:7203&from=2025-12-01&to=2025-12-05
x-api-key: <api-key>`}</code>
            </CodeBlock>
            <CodeBlock>
              <code>{`{
  "symbol": "TSE:7203",
  "market": "TSE",
  "provider": "jquants",
  "bars": [
    {
      "date": "2025-12-01",
      "open": "3132",
      "high": "3133",
      "low": "3075",
      "close": "3082",
      "volume": "13231700",
      "adjustedOpen": "3132",
      "adjustedHigh": "3133",
      "adjustedLow": "3075",
      "adjustedClose": "3082",
      "adjustedVolume": "13231700"
    }
  ]
}`}</code>
            </CodeBlock>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Options</CardTitle>
            <CardDescription>
              Options are REST-only. Do not subscribe to option chains over `/ws/prices`.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <CodeBlock>
              <code>{`GET /options?market=US&symbol=IBM&date=2017-11-15
GET /options?market=JP&symbol=2914&date=2025-12-01
x-api-key: <api-key>`}</code>
            </CodeBlock>
            <CodeBlock>
              <code>{`{
  "market": "US",
  "provider": "alphavantage",
  "symbol": "IBM",
  "date": "2017-11-15",
  "contracts": [
    {
      "contractID": "IBM171117C00075000",
      "symbol": "IBM",
      "expiration": "2017-11-17",
      "strike": "75.00",
      "type": "call"
    }
  ]
}`}</code>
            </CodeBlock>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Snapshot fields</CardTitle>
            <CardDescription>
              Fields returned inside every WebSocket `data` payload.
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
                  {snapshotFields.map(([field, meaning]) => (
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
      </div>

      <div className={activeTab === "consumer" ? "grid gap-5" : "hidden"} role="tabpanel">
        <Card>
          <CardHeader>
            <CardTitle>JavaScript consumer</CardTitle>
            <CardDescription>
              Browser clients pass the service key in the query string because custom WebSocket
              headers are not available.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock>
              <code>{`const wsUrl = new URL("/ws/prices", window.location.href);

wsUrl.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
wsUrl.searchParams.set("api_key", "<api-key>");

const socket = new WebSocket(wsUrl.toString());

socket.addEventListener("open", () => {
  socket.send(JSON.stringify({
    type: "subscribe",
    symbols: ["AAPL", "TSE:7203"],
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
              Keep one socket open and replace each symbol by its latest `price` message.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock>
              <code>{`import { useEffect, useState } from "react";

type Price = {
  symbol: string;
  price: string;
  marketState: "pre" | "regular" | "post" | "closed";
  source: "websocket" | "quote_api" | "redis_cache" | "jquants_daily" | "alphavantage_daily";
  provider: "twelvedata" | "jquants" | "alphavantage";
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
        symbols: ["AAPL", "TSE:7203"],
      }));
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);

      if (message.type !== "price") return;

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
