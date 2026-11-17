import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxyBigdataMcp } from "./bigdata-mcp-proxy.js";

const fetchMock = vi.fn();
const { recordGatewayLog } = vi.hoisted(() => ({ recordGatewayLog: vi.fn() }));

vi.mock("../services/gateway-logs.js", () => ({ recordGatewayLog }));

function loggedCalls() {
  return recordGatewayLog.mock.calls.map(([input]) => input.metadata);
}

function createFakeRedis() {
  const values = new Map<string, string>();

  return {
    values,
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
      return "OK";
    }),
  };
}

function mcpRequest(body: unknown, token = "Bearer token-a", headers: Record<string, string> = {}) {
  return new Request("http://localhost/bigdata/mcp", {
    method: "POST",
    headers: {
      authorization: token,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function toolCall(id: number, name: string, args: Record<string, unknown>) {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } };
}

function upstreamJson(body: unknown, init: ResponseInit = {}) {
  return () => Response.json(body, init);
}

const nvdaResult = { content: [{ type: "text", text: "NVDA" }] };

describe("bigdata MCP proxy", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    recordGatewayLog.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards a cacheable tool call, caches it for 24 hours, then serves hits per request id", async () => {
    const redis = createFakeRedis();
    fetchMock.mockImplementation(upstreamJson({ jsonrpc: "2.0", id: 1, result: nvdaResult }));

    const miss = await proxyBigdataMcp(
      mcpRequest(toolCall(1, "find_securities", { query: "NVDA", limit: 5 })),
      redis as never,
    );

    expect(miss.headers.get("x-bigdata-cache")).toBe("MISS");
    await expect(miss.json()).resolves.toEqual({ jsonrpc: "2.0", id: 1, result: nvdaResult });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://mcp.bigdata.com/");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer token-a");
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^bigdata:cache:find_securities:[0-9a-f]{64}$/),
      JSON.stringify(nvdaResult),
      "EX",
      86_400,
    );

    const hit = await proxyBigdataMcp(
      mcpRequest(toolCall(7, "find_securities", { limit: 5, query: "NVDA" })),
      redis as never,
    );

    expect(hit.headers.get("x-bigdata-cache")).toBe("HIT");
    await expect(hit.json()).resolves.toEqual({ jsonrpc: "2.0", id: 7, result: nvdaResult });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect(recordGatewayLog).toHaveBeenCalledWith(
      expect.objectContaining({ source: "bigdata", eventType: "tool_call" }),
    );
    const [missLog, hitLog] = loggedCalls();
    expect(missLog).toMatchObject({
      tool: "find_securities",
      cache: "MISS",
      status: 200,
      error: false,
      args: '{"limit":5,"query":"NVDA"}',
    });
    expect(hitLog).toMatchObject({ cache: "HIT", status: 200, error: false, errorReason: null });
    expect(missLog.caller).toMatch(/^[0-9a-f]{12}$/);
    expect(hitLog.caller).toBe(missLog.caller);
    expect(missLog.key).toMatch(/^[0-9a-f]{16}$/);
    expect(hitLog.key).toBe(missLog.key);
    expect(JSON.stringify(recordGatewayLog.mock.calls)).not.toContain("token-a");
  });

  it("does not share cached results across Bearer tokens", async () => {
    const redis = createFakeRedis();
    fetchMock.mockImplementation(upstreamJson({ jsonrpc: "2.0", id: 1, result: nvdaResult }));

    await proxyBigdataMcp(
      mcpRequest(toolCall(1, "find_securities", { query: "NVDA" })),
      redis as never,
    );
    const other = await proxyBigdataMcp(
      mcpRequest(toolCall(1, "find_securities", { query: "NVDA" }), "Bearer someone-else"),
      redis as never,
    );

    expect(other.headers.get("x-bigdata-cache")).toBe("MISS");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [first, second] = loggedCalls();
    expect(first.caller).not.toBe(second.caller);
    expect(first.key).not.toBe(second.key);
  });

  it("extracts the result from an SSE reply and passes the stream body through unchanged", async () => {
    const redis = createFakeRedis();
    const sse = [
      'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress","params":{"progress":1}}',
      `event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: "abc", result: nvdaResult })}`,
      "",
    ].join("\n\n");
    fetchMock.mockImplementation(
      () => new Response(sse, { headers: { "content-type": "text/event-stream" } }),
    );

    const response = await proxyBigdataMcp(
      mcpRequest({ ...toolCall(0, "bigdata_search", { query: "NVDA" }), id: "abc" }),
      redis as never,
    );

    expect(response.headers.get("content-type")).toBe("text/event-stream");
    await expect(response.text()).resolves.toBe(sse);
    expect(redis.set).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(nvdaResult),
      "EX",
      86_400,
    );
  });

  it("does not cache tool errors or failed HTTP responses, and logs why", async () => {
    const redis = createFakeRedis();
    fetchMock
      .mockImplementationOnce(
        upstreamJson({
          jsonrpc: "2.0",
          id: 1,
          result: { isError: true, content: [{ type: "text", text: "Unknown ticker" }] },
        }),
      )
      .mockImplementationOnce(upstreamJson({ message: "credits" }, { status: 402 }))
      .mockImplementationOnce(
        upstreamJson({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "Bad params" } }),
      )
      .mockImplementationOnce(() => new Response("not json"));

    const toolError = await proxyBigdataMcp(
      mcpRequest(toolCall(1, "bigdata_search", {})),
      redis as never,
    );
    const httpError = await proxyBigdataMcp(
      mcpRequest(toolCall(1, "bigdata_search", {})),
      redis as never,
    );

    await proxyBigdataMcp(mcpRequest(toolCall(1, "bigdata_search", {})), redis as never);
    await proxyBigdataMcp(mcpRequest(toolCall(1, "bigdata_search", {})), redis as never);

    expect(toolError.status).toBe(200);
    expect(httpError.status).toBe(402);
    expect(redis.set).not.toHaveBeenCalled();
    expect(loggedCalls()).toMatchObject([
      {
        cache: "MISS",
        status: 200,
        error: true,
        errorReason: "tool_error",
        errorDetail: "Unknown ticker",
      },
      {
        cache: "MISS",
        status: 402,
        error: true,
        errorReason: "http",
        errorDetail: '{"message":"credits"}',
      },
      {
        cache: "MISS",
        status: 200,
        error: true,
        errorReason: "rpc_error",
        errorDetail: "Bad params",
      },
      {
        cache: "MISS",
        status: 200,
        error: true,
        errorReason: "unparseable",
        errorDetail: "not json",
      },
    ]);
  });

  it("passes account-state tools and session traffic through without touching the cache", async () => {
    const redis = createFakeRedis();
    fetchMock.mockImplementation(
      upstreamJson(
        { jsonrpc: "2.0", id: 1, result: {} },
        { headers: { "mcp-session-id": "session-1" } },
      ),
    );

    const watchlist = await proxyBigdataMcp(
      mcpRequest(toolCall(1, "bigdata_get_watchlist", {})),
      redis as never,
    );
    const initialize = await proxyBigdataMcp(
      mcpRequest({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, "Bearer token-a", {
        "mcp-session-id": "session-1",
      }),
      redis as never,
    );

    expect(watchlist.headers.get("x-bigdata-cache")).toBeNull();
    expect(initialize.headers.get("mcp-session-id")).toBe("session-1");
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get("mcp-session-id")).toBe("session-1");
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
    // initialize is session traffic, not a tool call, so only the watchlist call is logged.
    expect(loggedCalls()).toMatchObject([
      { tool: "bigdata_get_watchlist", cache: "BYPASS", status: 200, error: false },
    ]);
  });

  it("logs an upstream failure as a 502 error and rethrows", async () => {
    fetchMock.mockRejectedValue(new Error("upstream down"));

    await expect(
      proxyBigdataMcp(mcpRequest(toolCall(1, "bigdata_search", {})), createFakeRedis() as never),
    ).rejects.toThrow("upstream down");
    expect(loggedCalls()).toMatchObject([
      {
        cache: "MISS",
        status: 502,
        error: true,
        errorReason: "exception",
        errorDetail: "upstream down",
      },
    ]);
  });

  it("logs a failed bypass call with its body and still passes the body through", async () => {
    fetchMock.mockImplementation(upstreamJson({ message: "unauthorized" }, { status: 401 }));

    const response = await proxyBigdataMcp(
      mcpRequest(toolCall(1, "bigdata_get_watchlist", {})),
      createFakeRedis() as never,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "unauthorized" });
    expect(loggedCalls()).toMatchObject([
      {
        cache: "BYPASS",
        status: 401,
        errorReason: "http",
        errorDetail: '{"message":"unauthorized"}',
      },
    ]);
  });
});
