import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { db } from "../db.js";

const keyPrefix = "ax";
const legacyKeyPrefixes = new Set(["rtp"]);
const algorithm = "aes-256-gcm";

export type ValidatedServiceApiKey = {
  id: string;
  name: string;
};

function getEncryptionKey() {
  const raw = process.env.API_KEY_ENCRYPTION_SECRET;

  if (!raw) {
    throw new Error("API_KEY_ENCRYPTION_SECRET is required");
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error("API_KEY_ENCRYPTION_SECRET must be a base64-encoded 32-byte key");
  }

  return key;
}

export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(encryptedSecret: string) {
  const [iv, authTag, encrypted] = encryptedSecret.split(".");

  if (!iv || !authTag || !encrypted) {
    throw new Error("Invalid encrypted API key secret");
  }

  const decipher = createDecipheriv(algorithm, getEncryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function generateServiceApiKey(id: string, secret = randomBytes(32).toString("base64url")) {
  return `${keyPrefix}_${id}_${secret}`;
}

export function parseServiceApiKey(apiKey: string) {
  const [prefix, id, ...secretParts] = apiKey.split("_");
  const secret = secretParts.join("_");

  if ((prefix !== keyPrefix && !legacyKeyPrefixes.has(prefix)) || !id || !secret) {
    return null;
  }

  return {
    id,
    secret,
  };
}

function safeCompare(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();

  return timingSafeEqual(leftHash, rightHash);
}

export async function createServiceApiKey(name: string) {
  const secret = randomBytes(32).toString("base64url");
  const apiKey = await db.serviceApiKey.create({
    data: {
      name,
      encryptedSecret: encryptSecret(secret),
    },
  });

  return {
    ...apiKey,
    key: generateServiceApiKey(apiKey.id, secret),
  };
}

export async function listServiceApiKeys() {
  const apiKeys = await db.serviceApiKey.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return apiKeys.map((apiKey) => ({
    id: apiKey.id,
    name: apiKey.name,
    key: generateServiceApiKey(apiKey.id, decryptSecret(apiKey.encryptedSecret)),
    active: apiKey.active,
    lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
    createdAt: apiKey.createdAt.toISOString(),
    updatedAt: apiKey.updatedAt.toISOString(),
  }));
}

export async function validateServiceApiKey(
  apiKey: string,
): Promise<ValidatedServiceApiKey | null> {
  const parsed = parseServiceApiKey(apiKey);

  if (!parsed) {
    return null;
  }

  const stored = await db.serviceApiKey.findUnique({
    where: {
      id: parsed.id,
    },
  });

  if (!stored?.active) {
    return null;
  }

  const valid = safeCompare(parsed.secret, decryptSecret(stored.encryptedSecret));

  if (valid) {
    await db.serviceApiKey.update({
      where: {
        id: stored.id,
      },
      data: {
        lastUsedAt: new Date(),
      },
    });
  }

  if (!valid) {
    return null;
  }

  return {
    id: stored.id,
    name: stored.name,
  };
}
