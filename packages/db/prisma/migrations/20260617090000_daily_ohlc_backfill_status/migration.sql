CREATE TABLE "DailyOhlcBackfillStatus" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "backfilledThrough" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyOhlcBackfillStatus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyOhlcBackfillStatus_symbol_key" ON "DailyOhlcBackfillStatus"("symbol");
CREATE INDEX "DailyOhlcBackfillStatus_backfilledThrough_idx" ON "DailyOhlcBackfillStatus"("backfilledThrough");
