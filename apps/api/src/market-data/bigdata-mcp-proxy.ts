import { createHash } from "node:crypto";
import type { Redis } from "ioredis";
import { bigdataMcpUrl, redisUrl } from "../config.js";
import { recordGatewayLog } from "../services/gateway-logs.js";
import { createRedisClient } from "./redis-bus.js";
import { bigdataCacheKey } from "./redis-keys.js";

type CacheStore = Pick<Redis, "get" | "set">;
type JsonObject = Record<string, unknown>;
type JsonRpcId = string | number;

const dayTtlSeconds = 60 * 60 * 24;
const droppedRequestHeaders = ["host", "content-length", "connection", "accept-encoding"];
// fetch already decoded the body, so the upstream framing headers no longer apply.
const droppedResponseHeaders = [
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
];

// Stateless MCP data tools. Every other MCP tool reads or mutates account state
// (watchlists, monitors, private docs, sandbox) and is passed through uncached.
export const cachedMcpTools = new Set([
  "find_securities",
  "get_securities",
  "find_entities",
  "list_entity_filter_values",
  "bigdata_search",
  "bigdata_watchlist_search",
  "bigdata_events_calendar",
  "bigdata_screen_companies",
  "bigdata_company_tearsheet",
  "bigdata_country_tearsheet",
  "bigdata_market_tearsheet",
  "bigdata_sentiment_tearsheet",
  "bigdata_etf_tearsheet",
  "bigdata_portfolio_tearsheet",
]);

let redis: Redis | undefined;

function getRedis() {
  redis ??= createRedisClient(redisUrl);
  return redis;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "null";
}

function parseToolCall(message: unknown) {
  if (!isObject(message) || message.method !== "tools/call") {
    return undefined;
  }

  const { id } = message;
  const params = isObject(message.params) ? message.params : {};

  if ((typeof id !== "string" && typeof id !== "number") || typeof params.name !== "string") {
    return undefined;
  }

  return { id, name: params.name, args: params.arguments ?? {} };
}

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function findResult(text: string, contentType: string | null, id: JsonRpcId) {
  const messages = contentType?.includes("text/event-stream")
    ? text.split(/\r?\n\r?\n/).map((event) =>
        parseJson(
          event
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).replace(/^ /, ""))
            .join("\n"),
        ),
      )
    : [parseJson(text)];
  const response = messages.find((message) => isObject(message) && message.id === id);

  return isObject(response) && isObject(response.result) ? response.result : undefined;
}

function responseHeaders(headers: Headers, cache?: "HIT" | "MISS") {
  const result = new Headers(headers);

  for (const name of droppedResponseHeaders) {
    result.delete(name);
  }

  if (cache) {
    result.set("x-bigdata-cache", cache);
  }

  return result;
}

function forward(request: Request, body: string | undefined) {
  const headers = new Headers(request.headers);

  for (const name of droppedRequestHeaders) {
    headers.delete(name);
  }

  return fetch(bigdataMcpUrl, { method: request.method, headers, body, signal: request.signal });
}

// Transparent MCP Streamable HTTP proxy to Bigdata. Only allowlisted `tools/call`
// requests touch the cache; sessions, notifications and SSE streams pass straight through.
// Every `tools/call` is logged to GatewayLog (source "bigdata") for the dashboard.
export async function proxyBigdataMcp(
  request: Request,
  store: CacheStore = getRedis(),
): Promise<Response> {
  const body = request.method === "POST" ? await request.text() : undefined;
  const call = body === undefined ? undefined : parseToolCall(parseJson(body));

  if (!call) {
    const upstream = await forward(request, body);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders(upstream.headers),
    });
  }

  const startedAt = Date.now();
  const token = request.headers.get("authorization") ?? "";
  const args = canonicalJson(call.args);
  const cache = cachedMcpTools.has(call.name) ? "MISS" : "BYPASS";
  const logCall = (outcome: "HIT" | "MISS" | "BYPASS", status: number, error: boolean) =>
    recordGatewayLog({
      source: "bigdata",
      eventType: "tool_call",
      message: `${call.name} ${outcome} ${status}`,
      metadata: {
        tool: call.name,
        cache: outcome,
        status,
        error,
        durationMs: Date.now() - startedAt,
        // Fingerprint only; the raw Bearer token is never stored.
        caller: sha256(token).slice(0, 12),
        args: args.slice(0, 300),
      },
    });

  try {
    if (cache === "BYPASS") {
      const upstream = await forward(request, body);
      logCall(cache, upstream.status, !upstream.ok);

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders(upstream.headers),
      });
    }

    // Keyed per Authorization header: a token only ever reads results its own upstream calls produced.
    const key = bigdataCacheKey(call.name, sha256(`${token}\n${args}`));
    const hit = await store.get(key);

    if (hit !== null) {
      const response = Response.json(
        { jsonrpc: "2.0", id: call.id, result: JSON.parse(hit) },
        { headers: { "x-bigdata-cache": "HIT" } },
      );
      logCall("HIT", 200, false);
      return response;
    }

    // ponytail: miss buffers the whole upstream reply (progress events arrive at the end); stream-tee if a client needs live progress
    // ponytail: no stampede lock; concurrent misses each call upstream, add SET NX lock if credits burn
    const upstream = await forward(request, body);
    const text = await upstream.text();
    const result = upstream.ok
      ? findResult(text, upstream.headers.get("content-type"), call.id)
      : undefined;
    const failed = !result || result.isError === true;

    if (!failed) {
      await store.set(key, JSON.stringify(result), "EX", dayTtlSeconds);
    }

    logCall(cache, upstream.status, failed);

    return new Response(text, {
      status: upstream.status,
      headers: responseHeaders(upstream.headers, cache),
    });
  } catch (error) {
    logCall(cache, 502, true);
    throw error;
  }
}
