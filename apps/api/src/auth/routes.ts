import { Hono } from "hono";
import { db } from "../db.js";
import { hashPassword, verifyPassword } from "./password.js";
import { clearSession, createSession, getCurrentUser, serializeUser } from "./session.js";

type AuthPayload = {
  email?: string;
  name?: string;
  password?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validatePassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 8;
}

export const authRoutes = new Hono();

authRoutes.get("/bootstrap", async (c) => {
  const userCount = await db.user.count();

  return c.json({
    registrationOpen: userCount === 0,
  });
});

authRoutes.get("/me", async (c) => {
  const user = await getCurrentUser(c);

  if (!user) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  return c.json({
    user: serializeUser(user),
  });
});

authRoutes.post("/register", async (c) => {
  const userCount = await db.user.count();

  if (userCount > 0) {
    return c.json({ message: "Registration is closed" }, 409);
  }

  const payload = (await c.req.json()) as AuthPayload;

  const password = payload.password;

  if (!payload.email || !payload.name || !validatePassword(password)) {
    return c.json({ message: "Name, email, and an 8+ character password are required" }, 400);
  }

  const user = await db.user.create({
    data: {
      email: normalizeEmail(payload.email),
      name: payload.name.trim(),
      passwordHash: await hashPassword(password),
    },
  });

  await createSession(c, user.id);

  return c.json({
    user: serializeUser(user),
  });
});

authRoutes.post("/login", async (c) => {
  const payload = (await c.req.json()) as AuthPayload;

  if (!payload.email || !payload.password) {
    return c.json({ message: "Email and password are required" }, 400);
  }

  const user = await db.user.findUnique({
    where: {
      email: normalizeEmail(payload.email),
    },
  });

  if (!user?.active || !(await verifyPassword(payload.password, user.passwordHash))) {
    return c.json({ message: "Invalid email or password" }, 401);
  }

  await createSession(c, user.id);

  return c.json({
    user: serializeUser(user),
  });
});

authRoutes.post("/logout", async (c) => {
  await clearSession(c);

  return c.json({
    ok: true,
  });
});
