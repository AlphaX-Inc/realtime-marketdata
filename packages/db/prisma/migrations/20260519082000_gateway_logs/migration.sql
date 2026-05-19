-- CreateTable
CREATE TABLE "GatewayLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "serviceApiKeyId" TEXT,
    "serviceApiKeyName" TEXT,
    "symbols" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatewayLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GatewayLog_createdAt_idx" ON "GatewayLog"("createdAt");

-- CreateIndex
CREATE INDEX "GatewayLog_eventType_idx" ON "GatewayLog"("eventType");

-- CreateIndex
CREATE INDEX "GatewayLog_serviceApiKeyId_idx" ON "GatewayLog"("serviceApiKeyId");

-- AddForeignKey
ALTER TABLE "GatewayLog" ADD CONSTRAINT "GatewayLog_serviceApiKeyId_fkey" FOREIGN KEY ("serviceApiKeyId") REFERENCES "ServiceApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
