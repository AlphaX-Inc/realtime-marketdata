import { describe, expect, it } from "vitest";
import { normalizeSymbols, parseMarketSymbol } from "./symbols.js";

describe("market symbol parsing", () => {
  it("keeps US symbols unchanged", () => {
    expect(parseMarketSymbol("aapl")).toEqual({
      market: "US",
      canonical: "AAPL",
      upstreamSymbol: "AAPL",
    });
  });

  it("canonicalizes TSE prefixed symbols", () => {
    expect(parseMarketSymbol("TSE:7203")).toEqual({
      market: "TSE",
      canonical: "TSE:7203",
      upstreamSymbol: "72030",
      jQuantsCode: "72030",
      tseCode: "7203",
    });
  });

  it("canonicalizes TSE suffixed symbols", () => {
    expect(parseMarketSymbol("72030.T")?.canonical).toBe("TSE:7203");
    expect(parseMarketSymbol("7203.T")?.canonical).toBe("TSE:7203");
  });

  it("rejects ambiguous numeric symbols without a TSE marker", () => {
    expect(parseMarketSymbol("7203")).toBeNull();
  });

  it("deduplicates normalized symbols", () => {
    expect(normalizeSymbols(["aapl", "AAPL", "7203.T", "TSE:7203", "bad symbol"])).toEqual([
      "AAPL",
      "TSE:7203",
    ]);
  });
});
