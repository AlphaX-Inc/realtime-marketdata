import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  db: {
    dailyOhlcBar: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    dailyOhlcBackfillStatus: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    optionContractDaily: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
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

const gatewayLogMocks = vi.hoisted(() => ({
  recordGatewayLog: vi.fn(),
}));

vi.mock("../db.js", () => dbMocks);
vi.mock("../providers/alphavantage.js", () => alphaMocks);
vi.mock("../providers/jquants.js", () => jQuantsMocks);
vi.mock("../services/gateway-logs.js", () => gatewayLogMocks);

describe("historical market data cache", () => {
  beforeEach(() => {
    dbMocks.db.dailyOhlcBar.findFirst.mockReset();
    dbMocks.db.dailyOhlcBar.findMany.mockReset();
    dbMocks.db.dailyOhlcBar.upsert.mockReset();
    dbMocks.db.dailyOhlcBackfillStatus.findUnique.mockReset();
    dbMocks.db.dailyOhlcBackfillStatus.upsert.mockReset();
    dbMocks.db.optionContractDaily.findMany.mockReset();
    dbMocks.db.optionContractDaily.upsert.mockReset();
    alphaMocks.fetchAlphaVantageDailyBars.mockReset();
    alphaMocks.fetchAlphaVantageOptions.mockReset();
    jQuantsMocks.fetchJQuantsDailyBars.mockReset();
    jQuantsMocks.fetchJQuantsOptions.mockReset();
    jQuantsMocks.normalizeJQuantsDailyBars.mockReset();
    gatewayLogMocks.recordGatewayLog.mockReset();

    dbMocks.db.dailyOhlcBar.upsert.mockResolvedValue({});
    dbMocks.db.dailyOhlcBackfillStatus.findUnique.mockResolvedValue(null);
    dbMocks.db.dailyOhlcBackfillStatus.upsert.mockResolvedValue({});
    dbMocks.db.optionContractDaily.upsert.mockResolvedValue({});
  });

  it("serves daily OHLC cache hits without calling upstream providers", async () => {
    dbMocks.db.dailyOhlcBar.findFirst.mockResolvedValue({
      date: new Date("2025-01-03T00:00:00.000Z"),
    });
    dbMocks.db.dailyOhlcBar.findMany.mockResolvedValue([
      {
        date: new Date("2025-01-02T00:00:00.000Z"),
        open: "100",
        high: "101",
        low: "99",
        close: "100",
        volume: "10",
        adjustedOpen: null,
        adjustedHigh: null,
        adjustedLow: null,
        adjustedClose: "100",
        adjustedVolume: "10",
      },
    ]);

    const { getCachedDailyOhlc } = await import("./historical-cache.js");
    const response = await getCachedDailyOhlc({
      parsed: {
        market: "US",
        canonical: "AAPL",
        upstreamSymbol: "AAPL",
      },
      from: "2025-01-01",
      to: "2025-01-03",
    });

    expect(alphaMocks.fetchAlphaVantageDailyBars).not.toHaveBeenCalled();
    expect(jQuantsMocks.fetchJQuantsDailyBars).not.toHaveBeenCalled();
    expect(response).toEqual({
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
          adjustedOpen: null,
          adjustedHigh: null,
          adjustedLow: null,
          adjustedClose: "100",
          adjustedVolume: "10",
        },
      ],
    });
  });

  it("backfills US daily OHLC from 2025-01-01 on cache miss", async () => {
    dbMocks.db.dailyOhlcBar.findFirst.mockResolvedValue(null);
    alphaMocks.fetchAlphaVantageDailyBars.mockResolvedValue([
      {
        date: "2025-01-02",
        open: "100",
        high: "101",
        low: "99",
        close: "100",
        volume: "10",
        adjustedClose: "100",
      },
    ]);
    dbMocks.db.dailyOhlcBar.findMany.mockResolvedValue([
      {
        date: new Date("2025-01-02T00:00:00.000Z"),
        open: "100",
        high: "101",
        low: "99",
        close: "100",
        volume: "10",
        adjustedOpen: null,
        adjustedHigh: null,
        adjustedLow: null,
        adjustedClose: "100",
        adjustedVolume: null,
      },
    ]);

    const { getCachedDailyOhlc } = await import("./historical-cache.js");
    await getCachedDailyOhlc({
      parsed: {
        market: "US",
        canonical: "AAPL",
        upstreamSymbol: "AAPL",
      },
      from: "2025-01-02",
      to: "2025-01-03",
    });

    expect(alphaMocks.fetchAlphaVantageDailyBars).toHaveBeenCalledWith({
      symbol: "AAPL",
      from: "2025-01-01",
      to: "2025-01-03",
    });
    expect(dbMocks.db.dailyOhlcBar.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          symbol_date: {
            symbol: "AAPL",
            date: new Date("2025-01-02T00:00:00.000Z"),
          },
        },
      }),
    );
    expect(dbMocks.db.dailyOhlcBackfillStatus.upsert).toHaveBeenCalledWith({
      where: {
        symbol: "AAPL",
      },
      create: {
        symbol: "AAPL",
        market: "US",
        provider: "alphavantage",
        backfilledThrough: new Date("2025-01-03T00:00:00.000Z"),
      },
      update: {
        market: "US",
        provider: "alphavantage",
        backfilledThrough: new Date("2025-01-03T00:00:00.000Z"),
      },
    });
    expect(gatewayLogMocks.recordGatewayLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ohlc_cache_miss",
        symbols: ["AAPL"],
      }),
    );
  });

  it("does not refetch when a backfill watermark already covers the requested date", async () => {
    dbMocks.db.dailyOhlcBar.findFirst.mockResolvedValue({
      date: new Date("2026-06-16T00:00:00.000Z"),
    });
    dbMocks.db.dailyOhlcBackfillStatus.findUnique.mockResolvedValue({
      backfilledThrough: new Date("2026-06-17T00:00:00.000Z"),
    });
    dbMocks.db.dailyOhlcBar.findMany.mockResolvedValue([
      {
        date: new Date("2026-06-16T00:00:00.000Z"),
        open: "100",
        high: "101",
        low: "99",
        close: "100",
        volume: "10",
        adjustedOpen: null,
        adjustedHigh: null,
        adjustedLow: null,
        adjustedClose: "100",
        adjustedVolume: "10",
      },
    ]);

    const { getCachedDailyOhlc } = await import("./historical-cache.js");
    await getCachedDailyOhlc({
      parsed: {
        market: "US",
        canonical: "AAPL",
        upstreamSymbol: "AAPL",
      },
      from: "2026-06-01",
      to: "2026-06-17",
    });

    expect(alphaMocks.fetchAlphaVantageDailyBars).not.toHaveBeenCalled();
    expect(dbMocks.db.dailyOhlcBackfillStatus.upsert).not.toHaveBeenCalled();
  });

  it("only fetches dates after the previous backfill watermark", async () => {
    dbMocks.db.dailyOhlcBar.findFirst.mockResolvedValue({
      date: new Date("2026-06-17T00:00:00.000Z"),
    });
    dbMocks.db.dailyOhlcBackfillStatus.findUnique.mockResolvedValue({
      backfilledThrough: new Date("2026-06-17T00:00:00.000Z"),
    });
    alphaMocks.fetchAlphaVantageDailyBars.mockResolvedValue([
      {
        date: "2026-06-18",
        open: "101",
        high: "102",
        low: "100",
        close: "101",
        volume: "11",
      },
    ]);
    dbMocks.db.dailyOhlcBar.findMany.mockResolvedValue([]);

    const { getCachedDailyOhlc } = await import("./historical-cache.js");
    await getCachedDailyOhlc({
      parsed: {
        market: "US",
        canonical: "AAPL",
        upstreamSymbol: "AAPL",
      },
      from: "2026-06-01",
      to: "2026-06-18",
    });

    expect(alphaMocks.fetchAlphaVantageDailyBars).toHaveBeenCalledWith({
      symbol: "AAPL",
      from: "2026-06-18",
      to: "2026-06-18",
    });
    expect(gatewayLogMocks.recordGatewayLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ohlc_cache_miss",
        metadata: expect.objectContaining({
          from: "2026-06-18",
          to: "2026-06-18",
        }),
      }),
    );
  });

  it("backfills TSE daily OHLC with canonical symbols and J-Quants code", async () => {
    dbMocks.db.dailyOhlcBar.findFirst.mockResolvedValue(null);
    jQuantsMocks.fetchJQuantsDailyBars.mockResolvedValue([{ Date: "2025-01-02", C: 2814 }]);
    jQuantsMocks.normalizeJQuantsDailyBars.mockReturnValue([
      {
        date: "2025-01-02",
        open: "2800",
        high: "2820",
        low: "2790",
        close: "2814",
        volume: "100",
      },
    ]);
    dbMocks.db.dailyOhlcBar.findMany.mockResolvedValue([]);

    const { backfillDailyOhlc } = await import("./historical-cache.js");
    await backfillDailyOhlc({
      parsed: {
        market: "TSE",
        canonical: "TSE:7203",
        upstreamSymbol: "72030",
        jQuantsCode: "72030",
        tseCode: "7203",
      },
      to: "2025-01-03",
    });

    expect(jQuantsMocks.fetchJQuantsDailyBars).toHaveBeenCalledWith({
      code: "72030",
      from: "2025-01-01",
      to: "2025-01-03",
    });
    expect(dbMocks.db.dailyOhlcBar.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          symbol: "TSE:7203",
          market: "TSE",
          provider: "jquants",
        }),
      }),
    );
  });

  it("deduplicates duplicate upstream dates before upsert", async () => {
    alphaMocks.fetchAlphaVantageDailyBars.mockResolvedValue([
      { date: "2025-01-02", close: "100" },
      { date: "2025-01-02", close: "101" },
    ]);

    const { backfillDailyOhlc } = await import("./historical-cache.js");
    await backfillDailyOhlc({
      parsed: {
        market: "US",
        canonical: "AAPL",
        upstreamSymbol: "AAPL",
      },
      to: "2025-01-03",
    });

    expect(dbMocks.db.dailyOhlcBar.upsert).toHaveBeenCalledTimes(1);
    expect(dbMocks.db.dailyOhlcBar.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          close: "101",
        }),
      }),
    );
  });

  it("serves cached US option contracts without calling Alpha Vantage", async () => {
    dbMocks.db.optionContractDaily.findMany.mockResolvedValue([
      {
        payload: {
          contractID: "IBM171117C00075000",
          strike: "75.00",
        },
      },
    ]);

    const { getCachedOptions } = await import("./historical-cache.js");
    const response = await getCachedOptions({
      market: "US",
      symbol: "ibm",
      date: "2017-11-15",
    });

    expect(alphaMocks.fetchAlphaVantageOptions).not.toHaveBeenCalled();
    expect(response).toEqual({
      market: "US",
      provider: "alphavantage",
      symbol: "IBM",
      date: "2017-11-15",
      contracts: [{ contractID: "IBM171117C00075000", strike: "75.00" }],
    });
  });

  it("backfills and filters US option contracts on cache miss", async () => {
    dbMocks.db.optionContractDaily.findMany.mockResolvedValue([]);
    alphaMocks.fetchAlphaVantageOptions.mockResolvedValue({
      market: "US",
      provider: "alphavantage",
      symbol: "IBM",
      date: "2017-11-15",
      contracts: [
        { contractID: "IBM171117C00075000", strike: "75.00" },
        { contractID: "IBM171117P00075000", strike: "75.00" },
      ],
    });

    const { getCachedOptions } = await import("./historical-cache.js");
    const response = await getCachedOptions({
      market: "US",
      symbol: "IBM",
      date: "2017-11-15",
      contract: "IBM171117C00075000",
    });

    expect(alphaMocks.fetchAlphaVantageOptions).toHaveBeenCalledWith({
      symbol: "IBM",
      date: "2017-11-15",
    });
    expect(dbMocks.db.optionContractDaily.upsert).toHaveBeenCalledTimes(2);
    expect(response.contracts).toEqual([{ contractID: "IBM171117C00075000", strike: "75.00" }]);
  });

  it("backfills and filters JP option contracts on cache miss", async () => {
    dbMocks.db.optionContractDaily.findMany.mockResolvedValue([]);
    jQuantsMocks.fetchJQuantsOptions.mockResolvedValue({
      market: "JP",
      provider: "jquants",
      symbol: "2914",
      date: "2025-12-01",
      contracts: [
        { Code: "JP202512C0001", UndSSO: "2914" },
        { Code: "JP202512P0001", UndSSO: "2914" },
      ],
    });

    const { getCachedOptions } = await import("./historical-cache.js");
    const response = await getCachedOptions({
      market: "JP",
      symbol: "2914",
      date: "2025-12-01",
      contract: "JP202512C0001",
    });

    expect(jQuantsMocks.fetchJQuantsOptions).toHaveBeenCalledWith({
      symbol: "2914",
      date: "2025-12-01",
    });
    expect(dbMocks.db.optionContractDaily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          market_symbol_date_contractId: {
            market: "JP",
            symbol: "2914",
            date: new Date("2025-12-01T00:00:00.000Z"),
            contractId: "JP202512C0001",
          },
        },
        create: expect.objectContaining({
          market: "JP",
          provider: "jquants",
        }),
      }),
    );
    expect(response).toEqual({
      market: "JP",
      provider: "jquants",
      symbol: "2914",
      date: "2025-12-01",
      contracts: [{ Code: "JP202512C0001", UndSSO: "2914" }],
    });
  });
});
