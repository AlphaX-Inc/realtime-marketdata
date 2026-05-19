import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:55432/realtime_pricing";
  process.env.API_KEY_ENCRYPTION_SECRET = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
});

describe("service API key helpers", () => {
  it("encrypts and decrypts service key secrets", async () => {
    const { decryptSecret, encryptSecret } = await import("./service-api-keys.js");
    const encrypted = encryptSecret("service-secret");

    expect(encrypted).not.toBe("service-secret");
    expect(decryptSecret(encrypted)).toBe("service-secret");
  });

  it("parses generated service API keys", async () => {
    const { generateServiceApiKey, parseServiceApiKey } = await import("./service-api-keys.js");
    const key = generateServiceApiKey("key-id", "service_secret-with-underscore");

    expect(key.startsWith("ax_key-id_")).toBe(true);
    expect(parseServiceApiKey(key)).toEqual({
      id: "key-id",
      secret: "service_secret-with-underscore",
    });
  });

  it("keeps parsing legacy rtp-prefixed service API keys", async () => {
    const { parseServiceApiKey } = await import("./service-api-keys.js");

    expect(parseServiceApiKey("rtp_key-id_service_secret-with-underscore")).toEqual({
      id: "key-id",
      secret: "service_secret-with-underscore",
    });
  });
});
