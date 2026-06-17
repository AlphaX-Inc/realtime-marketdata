import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  db: {
    stockSplitAdjustment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const gatewayLogMocks = vi.hoisted(() => ({
  recordGatewayLog: vi.fn(),
}));

const historicalCacheMocks = vi.hoisted(() => ({
  historicalBackfillStartDate: "2025-01-01",
  backfillDailyOhlc: vi.fn(),
}));

const adjustmentMocks = vi.hoisted(() => ({
  recomputeManualStockSplitAdjustments: vi.fn(),
}));

vi.mock("../db.js", () => dbMocks);
vi.mock("../services/gateway-logs.js", () => gatewayLogMocks);
vi.mock("./historical-cache.js", () => historicalCacheMocks);
vi.mock("./ohlc-adjustments.js", () => adjustmentMocks);

const splitRow = {
  id: "split_1",
  symbol: "KLAC",
  market: "US",
  adjustmentDate: new Date("2026-06-12T00:00:00.000Z"),
  ratioFrom: "1",
  ratioTo: "10",
  factor: "10",
  active: true,
  appliedAt: new Date("2026-06-17T00:00:00.000Z"),
  providerRefreshedAt: null,
  createdAt: new Date("2026-06-17T00:00:00.000Z"),
  updatedAt: new Date("2026-06-17T00:00:00.000Z"),
};

describe("stock split service", () => {
  beforeEach(() => {
    dbMocks.db.stockSplitAdjustment.findMany.mockReset();
    dbMocks.db.stockSplitAdjustment.findUnique.mockReset();
    dbMocks.db.stockSplitAdjustment.create.mockReset();
    dbMocks.db.stockSplitAdjustment.update.mockReset();
    gatewayLogMocks.recordGatewayLog.mockReset();
    historicalCacheMocks.backfillDailyOhlc.mockReset();
    adjustmentMocks.recomputeManualStockSplitAdjustments.mockReset();
    adjustmentMocks.recomputeManualStockSplitAdjustments.mockResolvedValue({ adjustedRows: 2 });
  });

  it("creates split metadata and recomputes manual OHLC adjustments", async () => {
    dbMocks.db.stockSplitAdjustment.findUnique.mockResolvedValue(null);
    dbMocks.db.stockSplitAdjustment.create.mockResolvedValue(splitRow);

    const { createStockSplit } = await import("./stock-splits.js");
    const response = await createStockSplit({
      symbol: "klac",
      adjustmentDate: "2026-06-12",
      ratioFrom: "1",
      ratioTo: "10",
    });

    expect(dbMocks.db.stockSplitAdjustment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        symbol: "KLAC",
        market: "US",
        adjustmentDate: new Date("2026-06-12T00:00:00.000Z"),
        ratioFrom: "1",
        ratioTo: "10",
        factor: "10",
        active: true,
        appliedAt: expect.any(Date),
      }),
    });
    expect(adjustmentMocks.recomputeManualStockSplitAdjustments).toHaveBeenCalledWith("KLAC");
    expect(response).toEqual({
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
  });

  it("rejects duplicate split dates for the same symbol", async () => {
    dbMocks.db.stockSplitAdjustment.findUnique.mockResolvedValue(splitRow);

    const { createStockSplit, StockSplitError } = await import("./stock-splits.js");

    await expect(
      createStockSplit({
        symbol: "KLAC",
        adjustmentDate: "2026-06-12",
        ratioFrom: "1",
        ratioTo: "10",
      }),
    ).rejects.toBeInstanceOf(StockSplitError);
    await expect(
      createStockSplit({
        symbol: "KLAC",
        adjustmentDate: "2026-06-12",
        ratioFrom: "1",
        ratioTo: "10",
      }),
    ).rejects.toHaveProperty("status", 409);
  });

  it("lists split events with canonical symbol filters", async () => {
    dbMocks.db.stockSplitAdjustment.findMany.mockResolvedValue([splitRow]);

    const { listStockSplits } = await import("./stock-splits.js");
    const response = await listStockSplits({
      symbols: ["klac", "7203.T"],
      from: "2026-01-01",
      to: "2026-12-31",
    });

    expect(dbMocks.db.stockSplitAdjustment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          symbol: {
            in: ["KLAC", "TSE:7203"],
          },
          adjustmentDate: {
            gte: new Date("2026-01-01T00:00:00.000Z"),
            lte: new Date("2026-12-31T00:00:00.000Z"),
          },
        },
      }),
    );
    expect(response).toHaveLength(1);
    expect(response[0]?.ratioFrom).toBe("1");
  });

  it("refreshes provider data and clears manual adjustment participation", async () => {
    dbMocks.db.stockSplitAdjustment.findUnique.mockResolvedValue(splitRow);
    dbMocks.db.stockSplitAdjustment.update.mockResolvedValue({
      ...splitRow,
      active: false,
      providerRefreshedAt: new Date("2026-06-17T01:00:00.000Z"),
      updatedAt: new Date("2026-06-17T01:00:00.000Z"),
    });
    adjustmentMocks.recomputeManualStockSplitAdjustments.mockResolvedValue({ adjustedRows: 0 });

    const { refreshStockSplitFromProvider } = await import("./stock-splits.js");
    const response = await refreshStockSplitFromProvider("split_1");

    expect(historicalCacheMocks.backfillDailyOhlc).toHaveBeenCalledWith({
      parsed: {
        market: "US",
        canonical: "KLAC",
        upstreamSymbol: "KLAC",
      },
      from: "2025-01-01",
      to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(dbMocks.db.stockSplitAdjustment.update).toHaveBeenCalledWith({
      where: {
        id: "split_1",
      },
      data: {
        active: false,
        providerRefreshedAt: expect.any(Date),
      },
    });
    expect(response.stockSplit.active).toBe(false);
    expect(response.adjustedRows).toBe(0);
  });
});
