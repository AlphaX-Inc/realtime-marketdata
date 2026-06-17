import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  db: {
    stockSplitAdjustment: {
      findMany: vi.fn(),
    },
    dailyOhlcBar: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../db.js", () => dbMocks);

describe("OHLC manual stock split adjustments", () => {
  beforeEach(() => {
    dbMocks.db.stockSplitAdjustment.findMany.mockReset();
    dbMocks.db.dailyOhlcBar.findMany.mockReset();
    dbMocks.db.dailyOhlcBar.update.mockReset();
    dbMocks.db.dailyOhlcBar.update.mockResolvedValue({});
  });

  it("divides pre-adjustment prices and multiplies volume for a 1 to 10 split", async () => {
    dbMocks.db.stockSplitAdjustment.findMany.mockResolvedValue([
      {
        adjustmentDate: new Date("2026-06-12T00:00:00.000Z"),
        factor: "10",
      },
    ]);
    dbMocks.db.dailyOhlcBar.findMany.mockResolvedValue([
      {
        id: "before",
        date: new Date("2026-06-11T00:00:00.000Z"),
        open: "2210",
        high: "2431",
        low: "2206",
        close: "2411",
        volume: "100",
      },
      {
        id: "on-date",
        date: new Date("2026-06-12T00:00:00.000Z"),
        open: "254",
        high: "255",
        low: "236",
        close: "254",
        volume: "200",
      },
    ]);

    const { recomputeManualStockSplitAdjustments } = await import("./ohlc-adjustments.js");
    const result = await recomputeManualStockSplitAdjustments("KLAC");

    expect(result).toEqual({ adjustedRows: 1 });
    expect(dbMocks.db.dailyOhlcBar.update).toHaveBeenCalledWith({
      where: {
        id: "before",
      },
      data: expect.objectContaining({
        manualAdjustedOpen: "221",
        manualAdjustedHigh: "243.1",
        manualAdjustedLow: "220.6",
        manualAdjustedClose: "241.1",
        manualAdjustedVolume: "1000",
        manualAdjustedAt: expect.any(Date),
      }),
    });
    expect(dbMocks.db.dailyOhlcBar.update).toHaveBeenCalledWith({
      where: {
        id: "on-date",
      },
      data: {
        manualAdjustedOpen: null,
        manualAdjustedHigh: null,
        manualAdjustedLow: null,
        manualAdjustedClose: null,
        manualAdjustedVolume: null,
        manualAdjustedAt: null,
      },
    });
  });

  it("compounds multiple active splits from raw provider values", async () => {
    dbMocks.db.stockSplitAdjustment.findMany.mockResolvedValue([
      {
        adjustmentDate: new Date("2026-06-12T00:00:00.000Z"),
        factor: "10",
      },
      {
        adjustmentDate: new Date("2026-06-15T00:00:00.000Z"),
        factor: "2",
      },
    ]);
    dbMocks.db.dailyOhlcBar.findMany.mockResolvedValue([
      {
        id: "before-both",
        date: new Date("2026-06-11T00:00:00.000Z"),
        open: "2000",
        high: "2000",
        low: "2000",
        close: "2000",
        volume: "10",
      },
    ]);

    const { recomputeManualStockSplitAdjustments } = await import("./ohlc-adjustments.js");
    await recomputeManualStockSplitAdjustments("KLAC");

    expect(dbMocks.db.dailyOhlcBar.update).toHaveBeenCalledWith({
      where: {
        id: "before-both",
      },
      data: expect.objectContaining({
        manualAdjustedOpen: "100",
        manualAdjustedHigh: "100",
        manualAdjustedLow: "100",
        manualAdjustedClose: "100",
        manualAdjustedVolume: "200",
      }),
    });
  });
});
