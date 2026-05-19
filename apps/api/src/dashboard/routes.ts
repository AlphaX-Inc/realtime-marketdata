import { Hono } from "hono";
import { requireCurrentUser } from "../auth/guard.js";
import { hashPassword } from "../auth/password.js";
import { db } from "../db.js";
import { listGatewayLogs, normalizeLogLimit } from "../services/gateway-logs.js";
import { createServiceApiKey, listServiceApiKeys } from "../services/service-api-keys.js";

type CreateUserPayload = {
  email?: string;
  name?: string;
  password?: string;
};

type UpdateUserPayload = {
  active?: boolean;
};

type CreateApiKeyPayload = {
  name?: string;
};

function serializeUserRow(user: {
  id: string;
  email: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export const dashboardRoutes = new Hono();

dashboardRoutes.use("*", async (c, next) => {
  const auth = await requireCurrentUser(c);

  if (auth.response) {
    return auth.response;
  }

  return next();
});

dashboardRoutes.get("/users", async (c) => {
  const users = await db.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  return c.json({
    users: users.map(serializeUserRow),
  });
});

dashboardRoutes.post("/users", async (c) => {
  const payload = (await c.req.json()) as CreateUserPayload;

  if (!payload.email || !payload.name || !payload.password || payload.password.length < 8) {
    return c.json({ message: "Name, email, and an 8+ character password are required" }, 400);
  }

  const user = await db.user.create({
    data: {
      email: normalizeEmail(payload.email),
      name: payload.name.trim(),
      passwordHash: await hashPassword(payload.password),
    },
  });

  return c.json({
    user: serializeUserRow(user),
  });
});

dashboardRoutes.patch("/users/:id", async (c) => {
  const payload = (await c.req.json()) as UpdateUserPayload;
  const active = typeof payload.active === "boolean" ? payload.active : undefined;

  if (active === undefined) {
    return c.json({ message: "active boolean is required" }, 400);
  }

  const user = await db.user.update({
    where: {
      id: c.req.param("id"),
    },
    data: {
      active,
    },
  });

  return c.json({
    user: serializeUserRow(user),
  });
});

dashboardRoutes.get("/api-keys", async (c) => {
  return c.json({
    apiKeys: await listServiceApiKeys(),
  });
});

dashboardRoutes.post("/api-keys", async (c) => {
  const payload = (await c.req.json()) as CreateApiKeyPayload;

  if (!payload.name?.trim()) {
    return c.json({ message: "Name is required" }, 400);
  }

  const apiKey = await createServiceApiKey(payload.name.trim());

  return c.json({
    apiKey: {
      id: apiKey.id,
      name: apiKey.name,
      key: apiKey.key,
      active: apiKey.active,
      lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
      createdAt: apiKey.createdAt.toISOString(),
      updatedAt: apiKey.updatedAt.toISOString(),
    },
  });
});

dashboardRoutes.delete("/api-keys/:id", async (c) => {
  await db.serviceApiKey.delete({
    where: {
      id: c.req.param("id"),
    },
  });

  return c.json({
    ok: true,
  });
});

dashboardRoutes.get("/logs", async (c) => {
  const limit = normalizeLogLimit(c.req.query("limit"));

  return c.json({
    logs: await listGatewayLogs(limit),
  });
});
