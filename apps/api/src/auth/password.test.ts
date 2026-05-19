import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("verifies the original password", async () => {
    const passwordHash = await hashPassword("correct-password");

    expect(await verifyPassword("correct-password", passwordHash)).toBe(true);
    expect(await verifyPassword("wrong-password", passwordHash)).toBe(false);
  });
});
