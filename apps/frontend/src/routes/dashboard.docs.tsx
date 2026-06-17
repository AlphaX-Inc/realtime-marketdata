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
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/docs")({
  validateSearch: (search: Record<string, unknown>): { tab: DocsTab } => ({
    tab: isDocsTab(search.tab) ? search.tab : "overview",
  }),
  component: DocsPage,
});

type DocsTab = "overview" | "live" | "ohlc" | "stockSplits" | "options" | "consumer";

const tabs = [
  ["overview", "Overview"],
  ["live", "Live prices"],
  ["ohlc", "Historical OHLC"],
  ["stockSplits", "Stock splits"],
  ["options", "Options"],
  ["consumer", "Consumer"],
] as const satisfies readonly [DocsTab, string][];
const tabValues = new Set<DocsTab>(tabs.map(([tab]) => tab));

const snapshotFields = [
  [
    "symbol",
    "Canonical symbol returned by the gateway, for example AAPL or TSE:7203.",
    "Gateway symbol parser",
  ],
  [
    "price",
    "Primary display price selected by the gateway.",
    "US regular: Twelve Data WebSocket tick. US pre/post/closed: Twelve Data extended_price if the Quote API response includes it; otherwise close, then previous_close. TSE: J-Quants adjusted daily close.",
  ],
  [
    "open, high, low, close",
    "OHLC fields from the latest quote or daily bar. close remains the official regular-session close.",
    "Twelve Data Quote API or J-Quants daily bars",
  ],
  [
    "previousClose",
    "Previous close. Null if the selected upstream response does not include a previous close or enough daily bars to derive one.",
    "Twelve Data Quote API or previous J-Quants daily bar",
  ],
  [
    "change, percentChange",
    "Computed or upstream-provided change values.",
    "Twelve Data quote / extended fields or gateway calculation for J-Quants",
  ],
  [
    "volume",
    "Quote or daily bar volume. Null if the selected upstream response does not include volume.",
    "Twelve Data Quote API or J-Quants daily bars",
  ],
  [
    "timestamp",
    "Unix timestamp for the selected source data.",
    "Selected upstream tick, quote, or bar",
  ],
  ["marketState", "pre, regular, post, or closed.", "Gateway market-hours calendar"],
  [
    "source",
    "websocket, quote_api, jquants_daily, alphavantage_daily, or redis_cache.",
    "Gateway routing metadata",
  ],
  ["provider", "twelvedata, jquants, or alphavantage.", "Upstream provider metadata"],
  [
    "stale",
    "true when an immediate cached snapshot is older than the stale window.",
    "Gateway Redis cache age",
  ],
] as const;

function isDocsTab(value: unknown): value is DocsTab {
  return typeof value === "string" && tabValues.has(value as DocsTab);
}

function DocsPage() {
  const { tab: activeTab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  function setActiveTab(tab: DocsTab) {
    void navigate({
      search: { tab },
    });
  }

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
        className="flex w-full flex-wrap gap-2 rounded-lg border border-border/70 bg-card/70 p-1"
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

      <div className={activeTab !== "consumer" ? "grid gap-5" : "hidden"} role="tabpanel">
        {activeTab === "overview" ? (
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
                    <td className="px-4 py-3 font-mono text-xs">/ohlc</td>
                    <td className="px-4 py-3">
                      Cached REST date-range query for one or more US and TSE symbols.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-950">Options chains</td>
                    <td className="px-4 py-3 font-mono text-xs">/options</td>
                    <td className="px-4 py-3">
                      Cached REST query for US Alpha Vantage and JP J-Quants option chains.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-950">Stock splits</td>
                    <td className="px-4 py-3 font-mono text-xs">/stock-splits</td>
                    <td className="px-4 py-3">
                      Manual split events that adjust cached historical OHLC before the adjustment
                      date.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
          </Card>
        ) : null}

        {activeTab === "overview" ? (
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
        ) : null}

        {activeTab === "overview" ? (
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
        ) : null}

        {activeTab === "live" ? (
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
        ) : null}

        {activeTab === "live" ? (
          <Card>
          <CardHeader>
            <CardTitle>Price source behavior</CardTitle>
            <CardDescription>
              `/ws/prices` normalizes multiple upstreams into one payload shape.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-border/70 bg-card/80">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/70 text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Market</th>
                    <th className="px-4 py-3 font-medium">Session</th>
                    <th className="px-4 py-3 font-medium">Provider / source</th>
                    <th className="px-4 py-3 font-medium">Price rule</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-950">US</td>
                    <td className="px-4 py-3 font-mono text-xs">regular</td>
                    <td className="px-4 py-3">Twelve Data WebSocket</td>
                    <td className="px-4 py-3">
                      <code>price</code> follows realtime WebSocket ticks. Quote fields are used as
                      supporting metadata if the latest Quote API response includes them.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-950">US</td>
                    <td className="px-4 py-3 font-mono text-xs">pre / post / closed</td>
                    <td className="px-4 py-3">Twelve Data Quote REST polling</td>
                    <td className="px-4 py-3">
                      <code>price</code> uses <code>extended_price</code> when Twelve Data returns
                      it, then falls back to <code>close</code> or <code>previousClose</code>.{" "}
                      <code>close</code> stays the official regular-session close.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-950">TSE</td>
                    <td className="px-4 py-3 font-mono text-xs">all sessions</td>
                    <td className="px-4 py-3">J-Quants daily REST polling</td>
                    <td className="px-4 py-3">
                      <code>price</code> uses the latest adjusted daily close from J-Quants.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-700">
              Closed-market polling does not mean overnight venue coverage. Twelve Data
              pre/post-market data may stop updating after the post-market session ends around 8:00
              PM ET. Yahoo Finance overnight prices can come from BOATS / Blue Ocean ATS, which is a
              separate 8:00 PM-4:00 AM ET feed and is not currently part of this gateway.
            </p>
          </CardContent>
          </Card>
        ) : null}

        {activeTab === "ohlc" ? (
          <Card>
          <CardHeader>
            <CardTitle>Daily OHLC</CardTitle>
            <CardDescription>
              Use `/ohlc` for cached multi-symbol ranges. `/daily-ohlc` remains available for
              single-symbol compatibility. Manual stock split adjustments are reflected in the
              returned OHLC fields.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <CodeBlock>
              <code>{`GET /ohlc?symbols=AAPL,NVDA,TSE:7203&from=2025-12-01&to=2025-12-05
x-api-key: <api-key>`}</code>
            </CodeBlock>
            <CodeBlock>
              <code>{`{
  "from": "2025-12-01",
  "to": "2025-12-05",
  "results": [
    {
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
    }
  ]
}`}</code>
            </CodeBlock>
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
        ) : null}

        {activeTab === "stockSplits" ? (
          <Card>
          <CardHeader>
            <CardTitle>Stock splits</CardTitle>
            <CardDescription>
              Manual split events are an operator tool for correcting cached historical OHLC during
              the window before upstream history is trusted.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="overflow-hidden rounded-lg border border-border/70 bg-card/80">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/70 text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Step</th>
                    <th className="px-4 py-3 font-medium">What happens</th>
                    <th className="px-4 py-3 font-medium">Where to verify</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-950">Apply split</td>
                    <td className="px-4 py-3">
                      `POST /stock-splits` stores the split event and recalculates cached OHLC rows
                      before the adjustment date.
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">/dashboard/stock-splits</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-950">Read prices</td>
                    <td className="px-4 py-3">
                      `/ohlc` and `/daily-ohlc` return the adjusted values directly in
                      `open/high/low/close/volume`.
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">/dashboard/tests</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-950">Refresh from provider</td>
                    <td className="px-4 py-3">
                      `POST /stock-splits/:id/refresh` reloads provider history, then disables that
                      manual adjustment to prevent double-adjusting.
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">/dashboard/stock-splits</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm leading-6 text-zinc-700">
              The adjustment date is the first post-split trading date. Only cached bars with{" "}
              <code>date &lt; adjustmentDate</code> are adjusted. For a <code>1 -&gt; 10</code>{" "}
              split, prices are divided by <code>10</code> and volume is multiplied by{" "}
              <code>10</code>.
            </p>
            <CodeBlock>
              <code>{`GET /stock-splits?symbols=KLAC,TSE:7203&from=2025-01-01&to=2026-06-17
POST /stock-splits
POST /stock-splits/:id/refresh
x-api-key: <api-key>`}</code>
            </CodeBlock>
            <CodeBlock>
              <code>{`{
  "symbol": "KLAC",
  "adjustmentDate": "2026-06-12",
  "ratioFrom": "1",
  "ratioTo": "10"
}`}</code>
            </CodeBlock>
            <CodeBlock>
              <code>{`{
  "stockSplit": {
    "symbol": "KLAC",
    "market": "US",
    "adjustmentDate": "2026-06-12",
    "ratioFrom": "1",
    "ratioTo": "10",
    "factor": "10",
    "active": true
  },
  "adjustedRows": 342
}`}</code>
            </CodeBlock>
            <CodeBlock>
              <code>{`// Cached raw provider row before the manual split is applied
{
  "date": "2026-06-11",
  "open": "2210",
  "high": "2431",
  "low": "2206",
  "close": "2411",
  "volume": "100"
}

// Same row returned by /ohlc and /daily-ohlc after a 1 -> 10 split
{
  "date": "2026-06-11",
  "open": "221",
  "high": "243.1",
  "low": "220.6",
  "close": "241.1",
  "volume": "1000",
  "adjustedOpen": "221",
  "adjustedHigh": "243.1",
  "adjustedLow": "220.6",
  "adjustedClose": "241.1",
  "adjustedVolume": "1000"
}`}</code>
            </CodeBlock>
          </CardContent>
          </Card>
        ) : null}

        {activeTab === "options" ? (
          <Card>
          <CardHeader>
            <CardTitle>Options</CardTitle>
            <CardDescription>
              Options are REST-only. US and JP options are cached by market, symbol, date, and
              contract ID.
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
        ) : null}

        {activeTab === "live" ? (
          <Card>
          <CardHeader>
            <CardTitle>Snapshot fields</CardTitle>
            <CardDescription>
              Fields returned inside every WebSocket `data` payload.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-border/70 bg-card/80">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-secondary/70 text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Field</th>
                    <th className="px-4 py-3 font-medium">Meaning</th>
                    <th className="px-4 py-3 font-medium">Data source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {snapshotFields.map(([field, meaning, dataSource]) => (
                    <tr key={field}>
                      <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-xs">
                        {field}
                      </td>
                      <td className="px-4 py-3 align-top">{meaning}</td>
                      <td className="px-4 py-3 align-top">{dataSource}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
          </Card>
        ) : null}
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
