export const marketDataChannels = {
  commands: "market-data:commands",
  ticks: "market-data:ticks",
} as const;

export const desiredSymbolLeasePrefix = "market-data:lease:";
export const snapshotPrefix = "market-data:snapshot:";

export function desiredSymbolLeaseKey(symbol: string) {
  return `${desiredSymbolLeasePrefix}${symbol}`;
}

export function snapshotKey(symbol: string) {
  return `${snapshotPrefix}${symbol}`;
}

export const bigdataCachePrefix = "bigdata:cache:";

export function bigdataCacheKey(tool: string, argsHash: string) {
  return `${bigdataCachePrefix}${tool}:${argsHash}`;
}
