import { describe, expect, it } from "vitest";
import { buildJQuantsSnapshot, normalizeJQuantsDailyBars } from "./jquants.js";

const bars = [
  {
    Date: "2025-12-01",
    Code: "72030",
    O: 3132,
    H: 3133,
    L: 3075,
    C: 3082,
    Vo: 13_231_700,
    AdjO: 3132,
    AdjH: 3133,
    AdjL: 3075,
    AdjC: 3082,
    AdjVo: 13_231_700,
  },
  {
    Date: "2025-12-02",
    Code: "72030",
    O: 3090,
    H: 3100,
    L: 3050,
    C: 3060,
    Vo: 10_000_000,
    AdjO: 3090,
    AdjH: 3100,
    AdjL: 3050,
    AdjC: 3060,
    AdjVo: 10_000_000,
  },
];

describe("J-Quants normalization", () => {
  it("uses adjusted daily OHLC values when available", () => {
    expect(normalizeJQuantsDailyBars([bars[0]])).toEqual([
      {
        date: "2025-12-01",
        open: "3132",
        high: "3133",
        low: "3075",
        close: "3082",
        volume: "13231700",
        adjustedOpen: "3132",
        adjustedHigh: "3133",
        adjustedLow: "3075",
        adjustedClose: "3082",
        adjustedVolume: "13231700",
      },
    ]);
  });

  it("builds latest TSE price snapshot from adjusted close", () => {
    const snapshot = buildJQuantsSnapshot("TSE:7203", bars, "closed", { now: 1000 });

    expect(snapshot).toMatchObject({
      symbol: "TSE:7203",
      price: "3060",
      close: "3060",
      previousClose: "3082",
      change: "-22",
      percentChange: "-0.7138221934",
      provider: "jquants",
      source: "jquants_daily",
      receivedAt: 1000,
    });
  });

  it("returns null when no close price is available", () => {
    expect(
      buildJQuantsSnapshot(
        "TSE:9999",
        [
          {
            Date: "2025-12-01",
            Code: "99990",
            C: null,
            AdjC: null,
          },
        ],
        "closed",
      ),
    ).toBeNull();
  });
});
