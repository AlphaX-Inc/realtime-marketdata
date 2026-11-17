import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  create: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("../db.js", () => ({
  db: {
    gatewayLog: dbMocks,
  },
}));

describe("gateway log helpers", () => {
  beforeEach(() => {
    dbMocks.create.mockReset();
    dbMocks.deleteMany.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("normalizes dashboard log limits", async () => {
    const { normalizeLogLimit } = await import("./gateway-logs.js");

    expect(normalizeLogLimit(undefined)).toBe(100);
    expect(normalizeLogLimit("25")).toBe(25);
    expect(normalizeLogLimit("0")).toBe(1);
    expect(normalizeLogLimit("1000")).toBe(500);
    expect(normalizeLogLimit("invalid")).toBe(100);
  });

  it("explains why a Bigdata call missed the cache", async () => {
    const { missReason } = await import("./gateway-logs.js");
    const at = (iso: string) => new Date(`2026-11-17T${iso}Z`);
    const miss = { cache: "MISS", key: "abc", durationMs: 500, createdAt: at("12:00:00.000") };
    const hour = 60 * 60 * 1000;

    expect(missReason({ ...miss, prevAt: null, lastStoredAt: null })).toBe("new");
    expect(missReason({ ...miss, prevAt: at("11:00:00.000"), lastStoredAt: null })).toBe(
      "prev_failed",
    );
    expect(
      missReason({
        ...miss,
        prevAt: at("11:00:00.000"),
        lastStoredAt: new Date(miss.createdAt.getTime() - 25 * hour),
      }),
    ).toBe("expired");
    expect(
      missReason({ ...miss, prevAt: at("11:59:59.800"), lastStoredAt: at("11:59:59.800") }),
    ).toBe("concurrent");
    expect(
      missReason({ ...miss, prevAt: at("11:00:00.000"), lastStoredAt: at("11:00:00.000") }),
    ).toBe("cache_lost");
    expect(missReason({ ...miss, cache: "HIT", prevAt: null, lastStoredAt: null })).toBeNull();
    expect(missReason({ ...miss, key: undefined, prevAt: null, lastStoredAt: null })).toBeNull();
  });

  it("does not throw when the async log write fails", async () => {
    const { recordGatewayLog } = await import("./gateway-logs.js");
    dbMocks.create.mockRejectedValueOnce(new Error("database unavailable"));

    expect(() =>
      recordGatewayLog({
        source: "downstream",
        eventType: "connected",
        message: "Connected WebSocket client",
      }),
    ).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(console.warn).toHaveBeenCalledWith("Gateway log write failed", "database unavailable");
  });
});
