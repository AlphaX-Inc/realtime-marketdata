import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceKeyMocks = vi.hoisted(() => ({
  validateServiceApiKey: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

const cacheMocks = vi.hoisted(() => ({
  getCachedDailyOhlc: vi.fn(),
  getCachedDailyOhlcBatch: vi.fn(),
  getCachedOptions: vi.fn(),
}));

const stockSplitMocks = vi.hoisted(() => {
  class StockSplitError extends Error {
    constructor(
      message: string,
      public readonly status = 400,
    ) {
      super(message);
    }
  }

  return {
    StockSplitError,
    createStockSplit: vi.fn(),
    listStockSplits: vi.fn(),
    refreshStockSplitFromProvider: vi.fn(),
  };
});

vi.mock("../services/service-api-keys.js", () => serviceKeyMocks);
vi.mock("../auth/session.js", () => authMocks);
vi.mock("../services/gateway-logs.js", () => ({
  recordGatewayLog: vi.fn(),
}));
vi.mock("./historical-cache.js", () => cacheMocks);
vi.mock("./stock-splits.js", () => stockSplitMocks);

describe("market data routes", () => {
  beforeEach(() => {
    serviceKeyMocks.validateServiceApiKey.mockReset();
    cacheMocks.getCachedDailyOhlc.mockReset();
    cacheMocks.getCachedDailyOhlcBatch.mockReset();
    cacheMocks.getCachedOptions.mockReset();
    authMocks.getCurrentUser.mockReset();
    stockSplitMocks.createStockSplit.mockReset();
    stockSplitMocks.listStockSplits.mockReset();
    stockSplitMocks.refreshStockSplitFromProvider.mockReset();
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
    cacheMocks.getCachedDailyOhlcBatch.mockResolvedValue([
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
    ]);

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
    expect(cacheMocks.getCachedDailyOhlcBatch).toHaveBeenCalledTimes(1);
    expect(cacheMocks.getCachedDailyOhlcBatch).toHaveBeenCalledWith({
      parsedSymbols: [
        {
          market: "US",
          canonical: "AAPL",
          upstreamSymbol: "AAPL",
        },
        {
          market: "TSE",
          canonical: "TSE:7203",
          upstreamSymbol: "72030",
          jQuantsCode: "72030",
          tseCode: "7203",
        },
      ],
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

  it("rejects stock split requests without service key or dashboard session", async () => {
    serviceKeyMocks.validateServiceApiKey.mockResolvedValue(null);
    authMocks.getCurrentUser.mockResolvedValue(null);
    const { marketDataRoutes } = await import("./routes.js");
    const response = await marketDataRoutes.request(
      "/stock-splits?symbols=KLAC&from=2025-01-01&to=2025-01-02",
    );

    expect(response.status).toBe(401);
  });

  it("lists stock split adjustments with service API key auth", async () => {
    serviceKeyMocks.validateServiceApiKey.mockResolvedValue({ id: "key" });
    stockSplitMocks.listStockSplits.mockResolvedValue([
      {
        id: "split_1",
        symbol: "KLAC",
        market: "US",
        adjustmentDate: "2026-06-12",
        ratioFrom: "1",
        ratioTo: "10",
        factor: "10",
        active: true,
        appliedAt: "2026-06-17T00:00:00.000Z",
        providerRefreshedAt: null,
        createdAt: "2026-06-17T00:00:00.000Z",
        updatedAt: "2026-06-17T00:00:00.000Z",
      },
    ]);
    const { marketDataRoutes } = await import("./routes.js");
    const response = await marketDataRoutes.request(
      "/stock-splits?symbols=KLAC,TSE:7203&from=2025-01-01&to=2026-06-17",
      {
        headers: {
          "x-api-key": "service-key",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(stockSplitMocks.listStockSplits).toHaveBeenCalledWith({
      symbols: ["KLAC", "TSE:7203"],
      from: "2025-01-01",
      to: "2026-06-17",
    });
    await expect(response.json()).resolves.toEqual({
      stockSplits: [
        {
          id: "split_1",
          symbol: "KLAC",
          market: "US",
          adjustmentDate: "2026-06-12",
          ratioFrom: "1",
          ratioTo: "10",
          factor: "10",
          active: true,
          appliedAt: "2026-06-17T00:00:00.000Z",
          providerRefreshedAt: null,
          createdAt: "2026-06-17T00:00:00.000Z",
          updatedAt: "2026-06-17T00:00:00.000Z",
        },
      ],
    });
  });

  it("creates stock split adjustments from dashboard session auth", async () => {
    serviceKeyMocks.validateServiceApiKey.mockResolvedValue(null);
    authMocks.getCurrentUser.mockResolvedValue({ id: "user" });
    stockSplitMocks.createStockSplit.mockResolvedValue({
      stockSplit: {
        id: "split_1",
        symbol: "KLAC",
        market: "US",
        adjustmentDate: "2026-06-12",
        ratioFrom: "1",
        ratioTo: "10",
        factor: "10",
        active: true,
        appliedAt: "2026-06-17T00:00:00.000Z",
        providerRefreshedAt: null,
        createdAt: "2026-06-17T00:00:00.000Z",
        updatedAt: "2026-06-17T00:00:00.000Z",
      },
      adjustedRows: 2,
    });
    const { marketDataRoutes } = await import("./routes.js");
    const response = await marketDataRoutes.request("/stock-splits", {
      method: "POST",
      body: JSON.stringify({
        symbol: "KLAC",
        adjustmentDate: "2026-06-12",
        ratioFrom: "1",
        ratioTo: "10",
      }),
    });

    expect(response.status).toBe(200);
    expect(stockSplitMocks.createStockSplit).toHaveBeenCalledWith({
      symbol: "KLAC",
      adjustmentDate: "2026-06-12",
      ratioFrom: "1",
      ratioTo: "10",
    });
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        adjustedRows: 2,
      }),
    );
  });

  it("rejects invalid stock split input", async () => {
    serviceKeyMocks.validateServiceApiKey.mockResolvedValue({ id: "key" });
    const { marketDataRoutes } = await import("./routes.js");

    await expect(
      marketDataRoutes.request("/stock-splits", {
        method: "POST",
        headers: {
          "x-api-key": "service-key",
        },
        body: JSON.stringify({
          symbol: "KLAC",
          adjustmentDate: "bad-date",
          ratioFrom: "1",
          ratioTo: "10",
        }),
      }),
    ).resolves.toHaveProperty("status", 400);

    await expect(
      marketDataRoutes.request("/stock-splits", {
        method: "POST",
        headers: {
          "x-api-key": "service-key",
        },
        body: JSON.stringify({
          symbol: "KLAC",
          adjustmentDate: "2026-06-12",
          ratioFrom: "1",
        }),
      }),
    ).resolves.toHaveProperty("status", 400);
  });

  it("refreshes a stock split from provider", async () => {
    serviceKeyMocks.validateServiceApiKey.mockResolvedValue({ id: "key" });
    stockSplitMocks.refreshStockSplitFromProvider.mockResolvedValue({
      stockSplit: {
        id: "split_1",
        symbol: "KLAC",
        market: "US",
        adjustmentDate: "2026-06-12",
        ratioFrom: "1",
        ratioTo: "10",
        factor: "10",
        active: false,
        appliedAt: "2026-06-17T00:00:00.000Z",
        providerRefreshedAt: "2026-06-17T01:00:00.000Z",
        createdAt: "2026-06-17T00:00:00.000Z",
        updatedAt: "2026-06-17T01:00:00.000Z",
      },
      adjustedRows: 0,
    });
    const { marketDataRoutes } = await import("./routes.js");
    const response = await marketDataRoutes.request("/stock-splits/split_1/refresh", {
      method: "POST",
      headers: {
        "x-api-key": "service-key",
      },
    });

    expect(response.status).toBe(200);
    expect(stockSplitMocks.refreshStockSplitFromProvider).toHaveBeenCalledWith("split_1");
  });
});
