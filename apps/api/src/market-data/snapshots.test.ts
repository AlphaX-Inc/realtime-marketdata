import { describe, expect, it } from "vitest";
import { buildSnapshotFromQuote, mergeTickWithQuote, toPublicSnapshot } from "./snapshots.js";

const quote = {
  open: "188.00",
  high: "191.00",
  low: "187.50",
  close: "189.50",
  previous_close: "187.20",
  change: "2.30",
  percent_change: "1.22",
  volume: "12345678",
  timestamp: 1_760_000_000,
  extended_price: "190.12",
  extended_change: "2.92",
  extended_percent_change: "1.56",
  extended_timestamp: 1_760_000_100,
};

describe("snapshot normalization", () => {
  it("uses websocket tick price during regular market", () => {
    const snapshot = mergeTickWithQuote(
      {
        symbol: "AAPL",
        price: "191.25",
        timestamp: 1_760_000_200,
      },
      quote,
      "regular",
      { now: 1000 },
    );

    expect(snapshot.price).toBe("191.25");
    expect(snapshot.open).toBe("188.00");
    expect(snapshot.source).toBe("websocket");
  });

  it("uses extended price during pre/post market", () => {
    const snapshot = buildSnapshotFromQuote("AAPL", quote, "post", { now: 1000 });

    expect(snapshot?.price).toBe("190.12");
    expect(snapshot?.change).toBe("2.92");
    expect(snapshot?.percentChange).toBe("1.56");
    expect(snapshot?.timestamp).toBe(1_760_000_100);
  });

  it("uses extended price for closed market when available", () => {
    const snapshot = buildSnapshotFromQuote("AAPL", quote, "closed", { now: 1000 });

    expect(snapshot?.price).toBe("190.12");
    expect(snapshot?.close).toBe("189.50");
    expect(snapshot?.previousClose).toBe("187.20");
    expect(snapshot?.change).toBe("2.92");
    expect(snapshot?.percentChange).toBe("1.56");
    expect(snapshot?.timestamp).toBe(1_760_000_100);
  });

  it("falls back to close for closed market without extended price", () => {
    const quoteWithoutExtended = {
      ...quote,
      extended_price: undefined,
      extended_change: undefined,
      extended_percent_change: undefined,
      extended_timestamp: undefined,
    };
    const snapshot = buildSnapshotFromQuote("AAPL", quoteWithoutExtended, "closed", { now: 1000 });

    expect(snapshot?.price).toBe("189.50");
    expect(snapshot?.change).toBe("2.30");
    expect(snapshot?.percentChange).toBe("1.22");
    expect(snapshot?.timestamp).toBe(1_760_000_000);
  });

  it("marks public snapshots stale from receivedAt", () => {
    const snapshot = buildSnapshotFromQuote("AAPL", quote, "closed", { now: 1000 });

    if (!snapshot) {
      throw new Error("Expected quote snapshot");
    }

    expect(toPublicSnapshot(snapshot, { now: 7001, staleAfterMs: 5000 }).stale).toBe(true);
  });
});
