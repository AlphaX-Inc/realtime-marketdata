import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Alpha Vantage client", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ALPHAVANTAGE_API_KEY = "test-key";
    process.env.ALPHAVANTAGE_MAX_RPS = "1000";
    process.env.ALPHAVANTAGE_MAX_RETRIES = "2";
    process.env.ALPHAVANTAGE_RETRY_BASE_DELAY_MS = "1";
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
              "8. split coefficient": "10",
            },
            "2025-12-01": {
              "1. open": "91",
              "2. high": "92",
              "3. low": "89",
              "4. close": "90",
              "5. adjusted close": "88",
              "6. volume": "456",
              "8. split coefficient": "1",
            },
          },
        }),
      })),
    );

    const { fetchAlphaVantageDailyBars } = await import("./alphavantage.js");

    await expect(
      fetchAlphaVantageDailyBars({
        symbol: "IBM",
        from: "2025-12-01",
        to: "2025-12-02",
      }),
    ).resolves.toEqual([
      {
        date: "2025-12-01",
        open: "91",
        high: "92",
        low: "89",
        close: "90",
        volume: "456",
        adjustedOpen: "9.1",
        adjustedHigh: "9.2",
        adjustedLow: "8.9",
        adjustedClose: "9",
        adjustedVolume: "4560",
      },
      {
        date: "2025-12-02",
        open: "101",
        high: "102",
        low: "99",
        close: "100",
        volume: "123",
        adjustedOpen: "101",
        adjustedHigh: "102",
        adjustedLow: "99",
        adjustedClose: "100",
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

  it("retries transient rate-limit responses and succeeds", async () => {
    const validBody = {
      "Time Series (Daily)": {
        "2025-12-01": {
          "1. open": "1",
          "2. high": "1",
          "3. low": "1",
          "4. close": "1",
          "6. volume": "1",
          "8. split coefficient": "1",
        },
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ Note: "rate limited" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => validBody });

    vi.stubGlobal("fetch", fetchMock);

    const { fetchAlphaVantageDailyBars } = await import("./alphavantage.js");

    await expect(
      fetchAlphaVantageDailyBars({ symbol: "IBM", from: "2025-12-01", to: "2025-12-01" }),
    ).resolves.toHaveLength(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after exhausting retries on repeated rate-limit responses", async () => {
    process.env.ALPHAVANTAGE_MAX_RETRIES = "1";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ Information: "rate limit exceeded" }),
    }));

    vi.stubGlobal("fetch", fetchMock);

    const { fetchAlphaVantageDailyBars } = await import("./alphavantage.js");

    await expect(
      fetchAlphaVantageDailyBars({ symbol: "IBM", from: "2025-12-01", to: "2025-12-01" }),
    ).rejects.toThrow(/rate limit exceeded/);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("spaces concurrent requests according to the configured rps", async () => {
    process.env.ALPHAVANTAGE_MAX_RPS = "100";
    process.env.ALPHAVANTAGE_MAX_RETRIES = "0";

    const timestamps: number[] = [];
    const fetchMock = vi.fn(async () => {
      timestamps.push(Date.now());
      return {
        ok: true,
        json: async () => ({ "Time Series (Daily)": {} }),
      };
    });

    vi.stubGlobal("fetch", fetchMock);

    const { fetchAlphaVantageDailyBars } = await import("./alphavantage.js");

    await Promise.all(
      Array.from({ length: 4 }, () =>
        fetchAlphaVantageDailyBars({ symbol: "IBM", from: "2025-12-01", to: "2025-12-01" }),
      ),
    );

    expect(timestamps).toHaveLength(4);

    const intervalMs = 1000 / 100;
    const tolerance = 2;

    for (let index = 1; index < timestamps.length; index += 1) {
      const delta = timestamps[index] - timestamps[index - 1];
      expect(delta).toBeGreaterThanOrEqual(intervalMs - tolerance);
    }
  });
});
