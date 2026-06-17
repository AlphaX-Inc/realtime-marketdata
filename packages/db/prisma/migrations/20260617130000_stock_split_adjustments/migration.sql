ALTER TABLE "DailyOhlcBar"
  ADD COLUMN "manualAdjustedOpen" TEXT,
  ADD COLUMN "manualAdjustedHigh" TEXT,
  ADD COLUMN "manualAdjustedLow" TEXT,
  ADD COLUMN "manualAdjustedClose" TEXT,
  ADD COLUMN "manualAdjustedVolume" TEXT,
  ADD COLUMN "manualAdjustedAt" TIMESTAMP(3);

CREATE TABLE "StockSplitAdjustment" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "adjustmentDate" DATE NOT NULL,
    "ratioFrom" TEXT NOT NULL,
    "ratioTo" TEXT NOT NULL,
    "factor" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "appliedAt" TIMESTAMP(3),
    "providerRefreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockSplitAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockSplitAdjustment_symbol_adjustmentDate_key"
  ON "StockSplitAdjustment"("symbol", "adjustmentDate");

CREATE INDEX "StockSplitAdjustment_symbol_adjustmentDate_idx"
  ON "StockSplitAdjustment"("symbol", "adjustmentDate");

CREATE INDEX "StockSplitAdjustment_market_adjustmentDate_idx"
  ON "StockSplitAdjustment"("market", "adjustmentDate");
