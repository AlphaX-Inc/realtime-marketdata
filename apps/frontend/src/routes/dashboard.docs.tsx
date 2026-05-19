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

export const Route = createFileRoute("/dashboard/docs")({
  component: DocsPage,
});

const fields = [
  ["symbol", "Normalized uppercase ticker requested by the client."],
  ["price", "Primary display price chosen by market state."],
  ["open, high, low, close", "OHLC fields from the Quote API snapshot."],
  ["previousClose", "Previous regular-session close from the Quote API."],
  ["change, percentChange", "Change values from the Quote API for the active price context."],
  ["volume", "Latest Quote API volume when available."],
  ["timestamp", "Unix timestamp from the price source."],
  ["marketState", "One of pre, regular, post, or closed."],
  [
    "source",
    "websocket for live regular ticks, quote_api for Quote API values, redis_cache for cached snapshots.",
  ],
  ["stale", "true when the returned cached snapshot is older than the configured stale window."],
] as const;

const marketStates = [
  ["pre", "04:00-09:30 America/New_York", "price uses Quote API extended_price when present."],
  ["regular", "09:30-16:00 America/New_York", "price uses live Twelve Data WebSocket ticks."],
  ["post", "16:00-20:00 America/New_York", "price uses Quote API extended_price when present."],
  [
    "closed",
    "Weekends and outside the above windows",
    "price uses close, falling back to previousClose.",
  ],
] as const;

function DocsPage() {
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

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
          <CardDescription>
            Connect services to this app only. The gateway owns the upstream Twelve Data connection.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-lg border border-primary/15 bg-accent/45 px-4 py-3 text-sm leading-6 text-zinc-700">
            Generate a service key from{" "}
            <span className="font-semibold text-zinc-950">API keys</span>, then connect to the
            gateway below. Backend services should send the key in a header; query-string auth is
            only for WebSocket clients that cannot send headers.
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
                <code>{`x-api-key: rtp_<keyId>_<secret>`}</code>
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
                <code>{`ws://localhost:3000/ws/prices?api_key=rtp_<keyId>_<secret>`}</code>
              </CodeBlock>
            </div>
          </div>
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
            client. Upstream unsubscribe happens after a short grace period if no other client still
            needs the symbol.
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
    "price": "190.12",
    "open": "188.00",
    "high": "191.00",
    "low": "187.50",
    "close": "189.50",
    "previousClose": "187.20",
    "change": "2.92",
    "percentChange": "1.56",
    "volume": "12345678",
    "timestamp": 1760000000,
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
            Pre-market and post-market are extended-hours sessions. The primary post-market price is
            still the `price` field, populated from Twelve Data `extended_price` when available.
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
  );
}
