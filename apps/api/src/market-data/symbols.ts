const symbolPattern = /^[A-Z][A-Z0-9.-]{0,14}$/;

export function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

export function normalizeSymbols(symbols: unknown) {
  if (!Array.isArray(symbols)) {
    return [];
  }

  return Array.from(
    new Set(
      symbols
        .filter((symbol): symbol is string => typeof symbol === "string")
        .map(normalizeSymbol)
        .filter((symbol) => symbolPattern.test(symbol)),
    ),
  );
}
