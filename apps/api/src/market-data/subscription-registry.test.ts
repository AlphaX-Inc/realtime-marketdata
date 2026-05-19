import { describe, expect, it } from "vitest";
import { SubscriptionRegistry } from "./subscription-registry.js";

describe("SubscriptionRegistry", () => {
  it("tracks first active and last inactive symbols", () => {
    const registry = new SubscriptionRegistry();

    expect(registry.subscribe("client-1", ["AAPL", "MSFT"])).toEqual(["AAPL", "MSFT"]);
    expect(registry.subscribe("client-2", ["AAPL"])).toEqual([]);
    expect(registry.activeSymbols().sort()).toEqual(["AAPL", "MSFT"]);

    expect(registry.unsubscribe("client-1", ["AAPL"])).toEqual([]);
    expect(registry.unsubscribe("client-2", ["AAPL"])).toEqual(["AAPL"]);
    expect(registry.activeSymbols()).toEqual(["MSFT"]);
  });

  it("removes all subscriptions for a disconnected client", () => {
    const registry = new SubscriptionRegistry();

    registry.subscribe("client-1", ["AAPL", "MSFT"]);
    registry.subscribe("client-2", ["MSFT"]);

    expect(registry.removeClient("client-1")).toEqual(["AAPL"]);
    expect(registry.activeSymbols()).toEqual(["MSFT"]);
  });
});
