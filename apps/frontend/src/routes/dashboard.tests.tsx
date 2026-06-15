import { ArrowsClockwise, Heartbeat, Lightning, Stop, WifiHigh } from "@phosphor-icons/react";
import { Alert, AlertDescription, AlertTitle } from "@realtime-pricing/ui/components/alert";
import { Badge } from "@realtime-pricing/ui/components/badge";
import { Button } from "@realtime-pricing/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@realtime-pricing/ui/components/card";
import { CodeBlock } from "@realtime-pricing/ui/components/code-block";
import { Input } from "@realtime-pricing/ui/components/input";
import { Label } from "@realtime-pricing/ui/components/label";
import { Skeleton } from "@realtime-pricing/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { listApiKeys } from "@/lib/api";

export const Route = createFileRoute("/dashboard/tests")({
  component: TestsPage,
});

type TestState = {
  status: "idle" | "running" | "success" | "error";
  statusCode?: number;
  durationMs?: number;
  body?: unknown;
  error?: string;
};

type TestId = "health" | "ohlc" | "dailyOhlc" | "usOptions" | "jpOptions";

const initialTests: Record<TestId, TestState> = {
  health: { status: "idle" },
  ohlc: { status: "idle" },
  dailyOhlc: { status: "idle" },
  usOptions: { status: "idle" },
  jpOptions: { status: "idle" },
};

const apiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL ?? "/api");

function normalizeApiBaseUrl(value: string) {
  if (value === "/") {
    return "";
  }

  return value.replace(/\/$/, "");
}

function buildApiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

function buildWsUrl(apiKey: string) {
  const url = new URL("/ws/prices", window.location.href);
  url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("api_key", apiKey);
  return url.toString();
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function statusVariant(status: TestState["status"]) {
  if (status === "success") {
    return "default";
  }

  if (status === "error") {
    return "destructive";
  }

  return "outline";
}

function statusLabel(status: TestState["status"]) {
  if (status === "running") {
    return "Running";
  }

  if (status === "success") {
    return "Passed";
  }

  if (status === "error") {
    return "Failed";
  }

  return "Idle";
}

function TestResult({ state }: { state: TestState }) {
  const payload =
    state.status === "error"
      ? { status: state.statusCode, message: state.error }
      : (state.body ?? { message: "Run the test to see the response." });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant(state.status)}>{statusLabel(state.status)}</Badge>
        {state.statusCode ? (
          <span className="font-mono text-xs text-muted-foreground">HTTP {state.statusCode}</span>
        ) : null}
        {typeof state.durationMs === "number" ? (
          <span className="font-mono text-xs text-muted-foreground">{state.durationMs} ms</span>
        ) : null}
      </div>
      <CodeBlock className="max-h-[360px] text-xs">
        <code>{prettyJson(payload)}</code>
      </CodeBlock>
    </div>
  );
}

function TestsPage() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("service-api-key") ?? "");
  const [selectedApiKeyId, setSelectedApiKeyId] = useState("");
  const [symbols, setSymbols] = useState("AAPL,NVDA,TSE:7203");
  const [dailySymbol, setDailySymbol] = useState("TSE:7203");
  const [from, setFrom] = useState("2025-01-01");
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [usOptionSymbol, setUsOptionSymbol] = useState("IBM");
  const [usOptionDate, setUsOptionDate] = useState("2017-11-15");
  const [usOptionContract, setUsOptionContract] = useState("");
  const [jpOptionSymbol, setJpOptionSymbol] = useState("2914");
  const [jpOptionDate, setJpOptionDate] = useState("2025-12-01");
  const [tests, setTests] = useState<Record<TestId, TestState>>(initialTests);
  const [wsSymbols, setWsSymbols] = useState("AAPL,TSE:7203");
  const [wsStatus, setWsStatus] = useState<"idle" | "connecting" | "open" | "closed" | "error">(
    "idle",
  );
  const [wsMessages, setWsMessages] = useState<unknown[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const apiKeysQuery = useQuery({
    queryKey: ["api-keys"],
    queryFn: listApiKeys,
  });
  const activeApiKeys = useMemo(
    () => (apiKeysQuery.data?.apiKeys ?? []).filter((item) => item.active),
    [apiKeysQuery.data?.apiKeys],
  );

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem("service-api-key", apiKey);
      return;
    }

    localStorage.removeItem("service-api-key");
  }, [apiKey]);

  useEffect(() => {
    const matchingKey = activeApiKeys.find((item) => item.key === apiKey);

    setSelectedApiKeyId(matchingKey?.id ?? "");
  }, [activeApiKeys, apiKey]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const endpoints = useMemo(
    () => ({
      health: "/health",
      ohlc: `/ohlc?symbols=${encodeURIComponent(symbols)}&from=${from}&to=${to}`,
      dailyOhlc: `/daily-ohlc?symbol=${encodeURIComponent(dailySymbol)}&from=${from}&to=${to}`,
      usOptions: `/options?market=US&symbol=${encodeURIComponent(usOptionSymbol)}&date=${usOptionDate}${
        usOptionContract ? `&contract=${encodeURIComponent(usOptionContract)}` : ""
      }`,
      jpOptions: `/options?market=JP&symbol=${encodeURIComponent(jpOptionSymbol)}&date=${jpOptionDate}`,
    }),
    [
      dailySymbol,
      from,
      jpOptionDate,
      jpOptionSymbol,
      symbols,
      to,
      usOptionContract,
      usOptionDate,
      usOptionSymbol,
    ],
  );

  async function runRestTest(id: TestId, requiresKey = true) {
    if (requiresKey && !apiKey.trim()) {
      setTests((current) => ({
        ...current,
        [id]: {
          status: "error",
          error: "Service API key is required for this endpoint.",
        },
      }));
      return;
    }

    const startedAt = performance.now();
    setTests((current) => ({
      ...current,
      [id]: { status: "running" },
    }));

    try {
      const response = await fetch(buildApiUrl(endpoints[id]), {
        headers: requiresKey
          ? {
              "x-api-key": apiKey.trim(),
            }
          : undefined,
      });
      const text = await response.text();
      const body = text ? JSON.parse(text) : null;
      const durationMs = Math.round(performance.now() - startedAt);

      setTests((current) => ({
        ...current,
        [id]: {
          status: response.ok ? "success" : "error",
          statusCode: response.status,
          durationMs,
          body: response.ok ? body : undefined,
          error: response.ok ? undefined : (body?.message ?? response.statusText),
        },
      }));
    } catch (error) {
      setTests((current) => ({
        ...current,
        [id]: {
          status: "error",
          durationMs: Math.round(performance.now() - startedAt),
          error: error instanceof Error ? error.message : "Request failed",
        },
      }));
    }
  }

  function startWebSocketTest() {
    if (!apiKey.trim()) {
      setWsStatus("error");
      setWsMessages([{ type: "error", message: "Service API key is required." }]);
      return;
    }

    wsRef.current?.close();
    setWsMessages([]);
    setWsStatus("connecting");

    const socket = new WebSocket(buildWsUrl(apiKey.trim()));
    wsRef.current = socket;

    socket.addEventListener("open", () => {
      setWsStatus("open");
      socket.send(
        JSON.stringify({
          type: "subscribe",
          symbols: wsSymbols
            .split(",")
            .map((symbol) => symbol.trim())
            .filter(Boolean),
        }),
      );
    });

    socket.addEventListener("message", (event) => {
      try {
        setWsMessages((current) => [JSON.parse(event.data), ...current].slice(0, 12));
      } catch {
        setWsMessages((current) => [event.data, ...current].slice(0, 12));
      }
    });

    socket.addEventListener("close", () => {
      setWsStatus((current) => (current === "error" ? current : "closed"));
    });

    socket.addEventListener("error", () => {
      setWsStatus("error");
    });
  }

  function stopWebSocketTest() {
    wsRef.current?.close();
    wsRef.current = null;
    setWsStatus("closed");
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">
            Endpoint tests
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
            Server test console
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Run authenticated REST and WebSocket smoke tests against the same gateway endpoints used
            by downstream clients.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void runRestTest("health", false);
          }}
        >
          <Heartbeat className="size-4" />
          Health
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service API key</CardTitle>
          <CardDescription>
            Select an active dashboard key or paste one manually. The chosen key is sent as
            `x-api-key` for market data tests.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="service-key-select">Available keys</Label>
            {apiKeysQuery.isLoading ? (
              <Skeleton className="h-10" />
            ) : apiKeysQuery.isError ? (
              <Alert variant="destructive">
                <AlertDescription>Unable to load API keys.</AlertDescription>
              </Alert>
            ) : activeApiKeys.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No active API keys found. Create one from the API keys page or paste a key below.
                </AlertDescription>
              </Alert>
            ) : (
              <select
                id="service-key-select"
                className="flex h-10 w-full rounded-md border border-input/80 bg-card/80 px-3 py-2 text-sm text-foreground shadow-[0_1px_0_hsl(0_0%_100%_/_0.8)_inset] transition-[border-color,box-shadow,background-color] focus-visible:border-primary/50 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/10"
                value={selectedApiKeyId}
                onChange={(event) => {
                  const selectedKey = activeApiKeys.find((item) => item.id === event.target.value);
                  setSelectedApiKeyId(event.target.value);

                  if (selectedKey) {
                    setApiKey(selectedKey.key);
                  }
                }}
              >
                <option value="">Manual key</option>
                {activeApiKeys.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                    {item.lastUsedAt
                      ? ` - last used ${new Date(item.lastUsedAt).toLocaleString()}`
                      : " - never used"}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="service-key">API key</Label>
            <Input
              id="service-key"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Paste service API key"
              type="password"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cached multi-symbol OHLC</CardTitle>
            <CardDescription>{endpoints.ohlc}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-[1.3fr_1fr_1fr]">
              <div className="grid gap-2">
                <Label htmlFor="ohlc-symbols">Symbols</Label>
                <Input
                  id="ohlc-symbols"
                  value={symbols}
                  onChange={(event) => setSymbols(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ohlc-from">From</Label>
                <Input
                  id="ohlc-from"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  type="date"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ohlc-to">To</Label>
                <Input
                  id="ohlc-to"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  type="date"
                />
              </div>
            </div>
            <Button type="button" onClick={() => void runRestTest("ohlc")}>
              <Lightning className="size-4" />
              Run OHLC
            </Button>
            <TestResult state={tests.ohlc} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Single-symbol compatibility</CardTitle>
            <CardDescription>{endpoints.dailyOhlc}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
              <div className="grid gap-2">
                <Label htmlFor="daily-symbol">Symbol</Label>
                <Input
                  id="daily-symbol"
                  value={dailySymbol}
                  onChange={(event) => setDailySymbol(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="daily-from">From</Label>
                <Input
                  id="daily-from"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  type="date"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="daily-to">To</Label>
                <Input
                  id="daily-to"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  type="date"
                />
              </div>
            </div>
            <Button type="button" onClick={() => void runRestTest("dailyOhlc")}>
              <ArrowsClockwise className="size-4" />
              Run Daily OHLC
            </Button>
            <TestResult state={tests.dailyOhlc} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>US options cache</CardTitle>
            <CardDescription>{endpoints.usOptions}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-[0.8fr_1fr_1.4fr]">
              <div className="grid gap-2">
                <Label htmlFor="us-option-symbol">Symbol</Label>
                <Input
                  id="us-option-symbol"
                  value={usOptionSymbol}
                  onChange={(event) => setUsOptionSymbol(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="us-option-date">Date</Label>
                <Input
                  id="us-option-date"
                  value={usOptionDate}
                  onChange={(event) => setUsOptionDate(event.target.value)}
                  type="date"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="us-option-contract">Contract</Label>
                <Input
                  id="us-option-contract"
                  value={usOptionContract}
                  onChange={(event) => setUsOptionContract(event.target.value)}
                  placeholder="Optional contract ID"
                />
              </div>
            </div>
            <Button type="button" onClick={() => void runRestTest("usOptions")}>
              <Lightning className="size-4" />
              Run US Options
            </Button>
            <TestResult state={tests.usOptions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>JP options cache</CardTitle>
            <CardDescription>{endpoints.jpOptions}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="jp-option-symbol">Symbol</Label>
                <Input
                  id="jp-option-symbol"
                  value={jpOptionSymbol}
                  onChange={(event) => setJpOptionSymbol(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jp-option-date">Date</Label>
                <Input
                  id="jp-option-date"
                  value={jpOptionDate}
                  onChange={(event) => setJpOptionDate(event.target.value)}
                  type="date"
                />
              </div>
            </div>
            <Button type="button" onClick={() => void runRestTest("jpOptions")}>
              <Lightning className="size-4" />
              Run JP Options
            </Button>
            <TestResult state={tests.jpOptions} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>WebSocket prices</CardTitle>
          <CardDescription>
            Opens `/ws/prices`, sends a subscribe message, and keeps the latest 12 messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div className="grid gap-2">
              <Label htmlFor="ws-symbols">Symbols</Label>
              <Input
                id="ws-symbols"
                value={wsSymbols}
                onChange={(event) => setWsSymbols(event.target.value)}
              />
            </div>
            <Button type="button" onClick={startWebSocketTest}>
              <WifiHigh className="size-4" />
              Connect
            </Button>
            <Button type="button" variant="outline" onClick={stopWebSocketTest}>
              <Stop className="size-4" />
              Stop
            </Button>
          </div>

          {wsStatus === "error" ? (
            <Alert variant="destructive">
              <AlertTitle>WebSocket failed</AlertTitle>
              <AlertDescription>Check the service API key and worker process.</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={wsStatus === "open" ? "default" : "outline"}>{wsStatus}</Badge>
            <span className="font-mono text-xs text-muted-foreground">
              {buildWsUrl(apiKey || "<api-key>")}
            </span>
          </div>
          <CodeBlock className="max-h-[420px] text-xs">
            <code>
              {prettyJson(
                wsMessages.length > 0
                  ? wsMessages
                  : [{ message: "Connect to start receiving price messages." }],
              )}
            </code>
          </CodeBlock>
        </CardContent>
      </Card>

      <TestResult state={tests.health} />
    </div>
  );
}
