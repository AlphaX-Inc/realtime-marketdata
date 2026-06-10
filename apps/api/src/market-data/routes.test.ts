import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceKeyMocks = vi.hoisted(() => ({
  validateServiceApiKey: vi.fn(),
}));

const alphaMocks = vi.hoisted(() => ({
  fetchAlphaVantageDailyBars: vi.fn(),
  fetchAlphaVantageOptions: vi.fn(),
}));

const jQuantsMocks = vi.hoisted(() => ({
  fetchJQuantsDailyBars: vi.fn(),
  fetchJQuantsOptions: vi.fn(),
  normalizeJQuantsDailyBars: vi.fn(),
}));

vi.mock("../services/service-api-keys.js", () => serviceKeyMocks);
vi.mock("../services/gateway-logs.js", () => ({
  recordGatewayLog: vi.fn(),
}));
vi.mock("../providers/alphavantage.js", () => alphaMocks);
vi.mock("../providers/jquants.js", () => jQuantsMocks);

describe("market data routes", () => {
  beforeEach(() => {
    serviceKeyMocks.validateServiceApiKey.mockReset();
    alphaMocks.fetchAlphaVantageDailyBars.mockReset();
    alphaMocks.fetchAlphaVantageOptions.mockReset();
    jQuantsMocks.fetchJQuantsDailyBars.mockReset();
    jQuantsMocks.fetchJQuantsOptions.mockReset();
    jQuantsMocks.normalizeJQuantsDailyBars.mockReset();
  });

  it("rejects requests without a service API key", async () => {
    serviceKeyMocks.validateServiceApiKey.mockResolvedValue(null);
    const { marketDataRoutes } = await import("./routes.js");
    const response = await marketDataRoutes.request(
      "/daily-ohlc?symbol=AAPL&from=2025-01-01&to=2025-01-02",
    );

    expect(response.status).toBe(401);
  });

  it("returns US daily OHLC from Alpha Vantage", async () => {
    serviceKeyMocks.validateServiceApiKey.mockResolvedValue({ id: "key" });
    alphaMocks.fetchAlphaVantageDailyBars.mockResolvedValue([
      {
        date: "2025-01-02",
        open: "100",
        high: "101",
        low: "99",
        close: "100",
        volume: "10",
      },
    ]);
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

  it("returns TSE daily OHLC from J-Quants", async () => {
    serviceKeyMocks.validateServiceApiKey.mockResolvedValue({ id: "key" });
    jQuantsMocks.fetchJQuantsDailyBars.mockResolvedValue([{ Date: "2025-12-01" }]);
    jQuantsMocks.normalizeJQuantsDailyBars.mockReturnValue([{ date: "2025-12-01" }]);
    const { marketDataRoutes } = await import("./routes.js");
    const response = await marketDataRoutes.request(
      "/daily-ohlc?symbol=7203.T&from=2025-12-01&to=2025-12-02",
      {
        headers: {
          "x-api-key": "service-key",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(jQuantsMocks.fetchJQuantsDailyBars).toHaveBeenCalledWith({
      code: "72030",
      from: "2025-12-01",
      to: "2025-12-02",
    });
    await expect(response.json()).resolves.toEqual({
      symbol: "TSE:7203",
      market: "TSE",
      provider: "jquants",
      bars: [{ date: "2025-12-01" }],
    });
  });

  it("returns options data", async () => {
    serviceKeyMocks.validateServiceApiKey.mockResolvedValue({ id: "key" });
    alphaMocks.fetchAlphaVantageOptions.mockResolvedValue({
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
    await expect(response.json()).resolves.toEqual({
      market: "US",
      provider: "alphavantage",
      symbol: "IBM",
      date: "2017-11-15",
      contracts: [{ contractID: "IBM171117C00075000" }],
    });
  });
});
