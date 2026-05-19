import { describe, expect, it } from "vitest";
import { getUsMarketState } from "./us-market-hours.js";

describe("getUsMarketState", () => {
  it("returns pre-market for weekday 08:00 ET", () => {
    expect(getUsMarketState(new Date("2026-05-18T12:00:00.000Z"))).toBe("pre");
  });

  it("returns regular for weekday 10:00 ET", () => {
    expect(getUsMarketState(new Date("2026-05-18T14:00:00.000Z"))).toBe("regular");
  });

  it("returns post-market for weekday 17:00 ET", () => {
    expect(getUsMarketState(new Date("2026-05-18T21:00:00.000Z"))).toBe("post");
  });

  it("returns closed for weekend", () => {
    expect(getUsMarketState(new Date("2026-05-16T16:00:00.000Z"))).toBe("closed");
  });
});
