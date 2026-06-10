import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Alpha Vantage client", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ALPHAVANTAGE_API_KEY = "test-key";
  });

  it("normalizes daily adjusted bars by requested date range", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          "Time Series (Daily)": {
            "2025-12-02": {
              "1. open": "101",
              "2. high": "102",
              "3. low": "99",
              "4. close": "100",
              "5. adjusted close": "98",
              "6. volume": "123",
            },
            "2025-12-01": {
              "1. open": "91",
              "2. high": "92",
              "3. low": "89",
              "4. close": "90",
              "5. adjusted close": "88",
              "6. volume": "456",
            },
          },
        }),
      })),
    );

    const { fetchAlphaVantageDailyBars } = await import("./alphavantage.js");

    await expect(
      fetchAlphaVantageDailyBars({
        symbol: "IBM",
        from: "2025-12-02",
        to: "2025-12-02",
      }),
    ).resolves.toEqual([
      {
        date: "2025-12-02",
        open: "101",
        high: "102",
        low: "99",
        close: "100",
        volume: "123",
        adjustedOpen: null,
        adjustedHigh: null,
        adjustedLow: null,
        adjustedClose: "98",
        adjustedVolume: "123",
      },
    ]);
  });

  it("normalizes historical option chains", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          message: "success",
          data: [
            {
              contractID: "IBM171117C00075000",
              symbol: "IBM",
              expiration: "2017-11-17",
              strike: "75.00",
            },
            {
              contractID: "IBM171117P00075000",
              symbol: "IBM",
              expiration: "2017-11-17",
              strike: "75.00",
            },
          ],
        }),
      })),
    );

    const { fetchAlphaVantageOptions } = await import("./alphavantage.js");

    await expect(
      fetchAlphaVantageOptions({
        symbol: "IBM",
        date: "2017-11-15",
        contract: "IBM171117C00075000",
      }),
    ).resolves.toEqual({
      market: "US",
      provider: "alphavantage",
      symbol: "IBM",
      date: "2017-11-15",
      contracts: [
        {
          contractID: "IBM171117C00075000",
          symbol: "IBM",
          expiration: "2017-11-17",
          strike: "75.00",
        },
      ],
    });
  });
});
