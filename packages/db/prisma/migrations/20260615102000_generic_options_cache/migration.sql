ALTER TABLE "UsOptionContractDaily" RENAME TO "OptionContractDaily";

ALTER TABLE "OptionContractDaily"
  ADD COLUMN "market" TEXT NOT NULL DEFAULT 'US',
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'alphavantage';

ALTER TABLE "OptionContractDaily"
  ALTER COLUMN "market" DROP DEFAULT,
  ALTER COLUMN "provider" DROP DEFAULT;

DROP INDEX IF EXISTS "UsOptionContractDaily_symbol_date_contractId_key";
DROP INDEX IF EXISTS "UsOptionContractDaily_symbol_date_idx";

CREATE UNIQUE INDEX "OptionContractDaily_market_symbol_date_contractId_key"
  ON "OptionContractDaily"("market", "symbol", "date", "contractId");

CREATE INDEX "OptionContractDaily_market_symbol_date_idx"
  ON "OptionContractDaily"("market", "symbol", "date");
