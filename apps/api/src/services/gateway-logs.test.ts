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
