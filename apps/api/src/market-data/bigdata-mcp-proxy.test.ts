import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxyBigdataMcp } from "./bigdata-mcp-proxy.js";

const fetchMock = vi.fn();

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
  });

  it("does not share cached results across Bearer tokens", async () => {
    const redis = createFakeRedis();
    fetchMock.mockImplementation(upstreamJson({ jsonrpc: "2.0", id: 1, result: nvdaResult }));

    await proxyBigdataMcp(mcpRequest(toolCall(1, "find_securities", { query: "NVDA" })), redis as never);
    const other = await proxyBigdataMcp(
      mcpRequest(toolCall(1, "find_securities", { query: "NVDA" }), "Bearer someone-else"),
      redis as never,
    );

    expect(other.headers.get("x-bigdata-cache")).toBe("MISS");
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

  it("does not cache tool errors or failed HTTP responses", async () => {
    const redis = createFakeRedis();
    fetchMock
      .mockImplementationOnce(
        upstreamJson({ jsonrpc: "2.0", id: 1, result: { isError: true, content: [] } }),
      )
      .mockImplementationOnce(upstreamJson({ message: "credits" }, { status: 402 }));

    const toolError = await proxyBigdataMcp(
      mcpRequest(toolCall(1, "bigdata_search", {})),
      redis as never,
    );
    const httpError = await proxyBigdataMcp(
      mcpRequest(toolCall(1, "bigdata_search", {})),
      redis as never,
    );

    expect(toolError.status).toBe(200);
    expect(httpError.status).toBe(402);
    expect(redis.set).not.toHaveBeenCalled();
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
  });
});
