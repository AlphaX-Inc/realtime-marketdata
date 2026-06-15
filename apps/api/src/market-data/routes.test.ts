import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceKeyMocks = vi.hoisted(() => ({
  validateServiceApiKey: vi.fn(),
}));

const cacheMocks = vi.hoisted(() => ({
  getCachedDailyOhlc: vi.fn(),
  getCachedOptions: vi.fn(),
}));

vi.mock("../services/service-api-keys.js", () => serviceKeyMocks);
vi.mock("../services/gateway-logs.js", () => ({
  recordGatewayLog: vi.fn(),
}));
vi.mock("./historical-cache.js", () => cacheMocks);

describe("market data routes", () => {
  beforeEach(() => {
    serviceKeyMocks.validateServiceApiKey.mockReset();
    cacheMocks.getCachedDailyOhlc.mockReset();
    cacheMocks.getCachedOptions.mockReset();
  });

  it("rejects OHLC requests without a service API key", async () => {
    serviceKeyMocks.validateServiceApiKey.mockResolvedValue(null);
    const { marketDataRoutes } = await import("./routes.js");
    const response = await marketDataRoutes.request(
      "/ohlc?symbols=AAPL&from=2025-01-01&to=2025-01-02",
    );

    expect(response.status).toBe(401);
  });

  it("rejects invalid OHLC query input", async () => {
    serviceKeyMocks.validateServiceApiKey.mockResolvedValue({ id: "key" });
    const { marketDataRoutes } = await import("./routes.js");

    await expect(
      marketDataRoutes.request("/ohlc?symbols=AAPL&from=2025-01-02&to=2025-01-01", {
        headers: {
          "x-api-key": "service-key",
        },
      }),
    ).resolves.toHaveProperty("status", 400);

    await expect(
      marketDataRoutes.request("/ohlc?symbols=&from=2025-01-01&to=2025-01-02", {
        headers: {
          "x-api-key": "service-key",
        },
      }),
    ).resolves.toHaveProperty("status", 400);

    await expect(
      marketDataRoutes.request("/ohlc?symbols=bad symbol&from=2025-01-01&to=2025-01-02", {
        headers: {
          "x-api-key": "service-key",
        },
      }),
    ).resolves.toHaveProperty("status", 400);
  });

  it("returns multi-symbol OHLC from the cache service", async () => {
    serviceKeyMocks.validateServiceApiKey.mockResolvedValue({ id: "key" });
    cacheMocks.getCachedDailyOhlc
      .mockResolvedValueOnce({
        symbol: "AAPL",
        market: "US",
        provider: "alphavantage",
        bars: [{ date: "2025-01-02", close: "100" }],
      })
      .mockResolvedValueOnce({
        symbol: "TSE:7203",
        market: "TSE",
        provider: "jquants",
        bars: [{ date: "2025-01-02", close: "2814" }],
      });

    const { marketDataRoutes } = await import("./routes.js");
    const response = await marketDataRoutes.request(
      "/ohlc?symbols=AAPL,AAPL,7203.T&from=2025-01-01&to=2025-01-02",
      {
        headers: {
          "x-api-key": "service-key",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(cacheMocks.getCachedDailyOhlc).toHaveBeenCalledTimes(2);
    expect(cacheMocks.getCachedDailyOhlc).toHaveBeenNthCalledWith(1, {
      parsed: {
        market: "US",
        canonical: "AAPL",
        upstreamSymbol: "AAPL",
      },
      from: "2025-01-01",
      to: "2025-01-02",
    });
    expect(cacheMocks.getCachedDailyOhlc).toHaveBeenNthCalledWith(2, {
      parsed: {
        market: "TSE",
        canonical: "TSE:7203",
        upstreamSymbol: "72030",
        jQuantsCode: "72030",
        tseCode: "7203",
      },
      from: "2025-01-01",
      to: "2025-01-02",
    });
    await expect(response.json()).resolves.toEqual({
      from: "2025-01-01",
      to: "2025-01-02",
      results: [
        {
          symbol: "AAPL",
          market: "US",
          provider: "alphavantage",
          bars: [{ date: "2025-01-02", close: "100" }],
        },
        {
          symbol: "TSE:7203",
          market: "TSE",
          provider: "jquants",
          bars: [{ date: "2025-01-02", close: "2814" }],
        },
      ],
    });
  });

  it("preserves the single-symbol daily OHLC response shape", async () => {
    serviceKeyMocks.validateServiceApiKey.mockResolvedValue({ id: "key" });
    cacheMocks.getCachedDailyOhlc.mockResolvedValue({
      symbol: "AAPL",
      market: "US",
      provider: "alphavantage",
      bars: [
        {
          date: "2025-01-02",
          open: "100",
          high: "101",
          low: "99",
          close: "100",
          volume: "10",
        },
      ],
    });
    const { marketDataRoutes } = await import("./routes.js");
    const response = await marketDataRoutes.request(
      "/daily-ohlc?symbol=AAPL&from=2025-01-01&to=2025-01-02",
      {
        headers: {
          "x-api-key": "service-key",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(cacheMocks.getCachedDailyOhlc).toHaveBeenCalledWith({
      parsed: {
        market: "US",
        canonical: "AAPL",
        upstreamSymbol: "AAPL",
      },
      from: "2025-01-01",
      to: "2025-01-02",
    });
    await expect(response.json()).resolves.toEqual({
      symbol: "AAPL",
      market: "US",
      provider: "alphavantage",
      bars: [
        {
          date: "2025-01-02",
          open: "100",
          high: "101",
          low: "99",
          close: "100",
          volume: "10",
        },
      ],
    });
  });

  it("returns cached US options data", async () => {
    serviceKeyMocks.validateServiceApiKey.mockResolvedValue({ id: "key" });
    cacheMocks.getCachedOptions.mockResolvedValue({
      market: "US",
      provider: "alphavantage",
      symbol: "IBM",
      date: "2017-11-15",
      contracts: [{ contractID: "IBM171117C00075000" }],
    });
    const { marketDataRoutes } = await import("./routes.js");
    const response = await marketDataRoutes.request(
      "/options?market=US&symbol=IBM&date=2017-11-15",
      {
        headers: {
          "x-api-key": "service-key",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(cacheMocks.getCachedOptions).toHaveBeenCalledWith({
      market: "US",
      symbol: "IBM",
      date: "2017-11-15",
      contract: undefined,
    });
    await expect(response.json()).resolves.toEqual({
      market: "US",
      provider: "alphavantage",
      symbol: "IBM",
      date: "2017-11-15",
      contracts: [{ contractID: "IBM171117C00075000" }],
    });
  });

  it("returns cached JP options data", async () => {
    serviceKeyMocks.validateServiceApiKey.mockResolvedValue({ id: "key" });
    cacheMocks.getCachedOptions.mockResolvedValue({
      market: "JP",
      provider: "jquants",
      symbol: "2914",
      date: "2025-12-01",
      contracts: [{ Code: "12345" }],
    });
    const { marketDataRoutes } = await import("./routes.js");
    const response = await marketDataRoutes.request(
      "/options?market=JP&symbol=2914&date=2025-12-01",
      {
        headers: {
          "x-api-key": "service-key",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(cacheMocks.getCachedOptions).toHaveBeenCalledWith({
      market: "JP",
      symbol: "2914",
      date: "2025-12-01",
      contract: undefined,
    });
    await expect(response.json()).resolves.toEqual({
      market: "JP",
      provider: "jquants",
      symbol: "2914",
      date: "2025-12-01",
      contracts: [{ Code: "12345" }],
    });
  });
});
