CREATE TABLE "DailyOhlcBar" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "open" TEXT,
    "high" TEXT,
    "low" TEXT,
    "close" TEXT,
    "volume" TEXT,
    "adjustedOpen" TEXT,
    "adjustedHigh" TEXT,
    "adjustedLow" TEXT,
    "adjustedClose" TEXT,
    "adjustedVolume" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyOhlcBar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsOptionContractDaily" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "contractId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsOptionContractDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyOhlcBar_symbol_date_key" ON "DailyOhlcBar"("symbol", "date");
CREATE INDEX "DailyOhlcBar_symbol_date_idx" ON "DailyOhlcBar"("symbol", "date");
CREATE INDEX "DailyOhlcBar_market_date_idx" ON "DailyOhlcBar"("market", "date");

CREATE UNIQUE INDEX "UsOptionContractDaily_symbol_date_contractId_key" ON "UsOptionContractDaily"("symbol", "date", "contractId");
CREATE INDEX "UsOptionContractDaily_symbol_date_idx" ON "UsOptionContractDaily"("symbol", "date");
