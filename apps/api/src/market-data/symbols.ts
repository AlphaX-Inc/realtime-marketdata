const usSymbolPattern = /^[A-Z][A-Z0-9.-]{0,14}$/;
const tsePrefixedPattern = /^TSE:(\d{4,5})$/;
const tseSuffixedPattern = /^(\d{4,5})\.T$/;

export type ParsedMarketSymbol =
  | {
      market: "US";
      canonical: string;
      upstreamSymbol: string;
    }
  | {
      market: "TSE";
      canonical: string;
      upstreamSymbol: string;
      jQuantsCode: string;
      tseCode: string;
    };

function normalizeTseCode(code: string) {
  if (/^\d{5}$/.test(code) && code.endsWith("0")) {
    return code.slice(0, 4);
  }

  if (/^\d{4}$/.test(code)) {
    return code;
  }

  return null;
}

export function normalizeSymbol(symbol: string) {
  return parseMarketSymbol(symbol)?.canonical ?? symbol.trim().toUpperCase();
}

export function parseMarketSymbol(symbol: string): ParsedMarketSymbol | null {
  const value = symbol.trim().toUpperCase();
  const tsePrefixed = value.match(tsePrefixedPattern);
  const tseSuffixed = value.match(tseSuffixedPattern);
  const tseCode = normalizeTseCode(tsePrefixed?.[1] ?? tseSuffixed?.[1] ?? "");

  if (tseCode) {
    return {
      market: "TSE",
      canonical: `TSE:${tseCode}`,
      upstreamSymbol: `${tseCode}0`,
      jQuantsCode: `${tseCode}0`,
      tseCode,
    };
  }

  if (usSymbolPattern.test(value) && !/^\d/.test(value)) {
    return {
      market: "US",
      canonical: value,
      upstreamSymbol: value,
    };
  }

  return null;
}

export function normalizeSymbols(symbols: unknown) {
  if (!Array.isArray(symbols)) {
    return [];
  }

  return Array.from(
    new Set(
      symbols
        .filter((symbol): symbol is string => typeof symbol === "string")
        .map((symbol) => parseMarketSymbol(symbol)?.canonical)
        .filter((symbol): symbol is string => Boolean(symbol)),
    ),
  );
}
