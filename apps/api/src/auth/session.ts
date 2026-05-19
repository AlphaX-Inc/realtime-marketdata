import { createHash, randomBytes } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { db, type User } from "../db.js";

export const sessionCookieName = "rp_session";

const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

export type CurrentUser = Pick<
  User,
  "id" | "email" | "name" | "active" | "createdAt" | "updatedAt"
>;

export function serializeUser(user: CurrentUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export async function createSession(c: Context, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000);

  await db.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  setCookie(c, sessionCookieName, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  });
}

export async function clearSession(c: Context) {
  const token = getCookie(c, sessionCookieName);

  if (token) {
    await db.session.deleteMany({
      where: {
        tokenHash: hashSessionToken(token),
      },
    });
  }

  deleteCookie(c, sessionCookieName, {
    path: "/",
  });
}

export async function getCurrentUser(c: Context) {
  const token = getCookie(c, sessionCookieName);

  if (!token) {
    return null;
  }

  const session = await db.session.findFirst({
    where: {
      tokenHash: hashSessionToken(token),
      expiresAt: {
        gt: new Date(),
      },
      user: {
        active: true,
      },
    },
    include: {
      user: true,
    },
  });

  return session?.user ?? null;
}
