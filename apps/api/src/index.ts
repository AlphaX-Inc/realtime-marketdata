import "./env.js";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./auth/routes.js";
import { dashboardRoutes } from "./dashboard/routes.js";
import { marketDataRoutes } from "./market-data/routes.js";
import { recordGatewayLog } from "./services/gateway-logs.js";
import { type ValidatedServiceApiKey, validateServiceApiKey } from "./services/service-api-keys.js";
import { createInternalPricesGateway } from "./ws/internal-prices.js";

type AppVariables = {
  serviceApiKey: ValidatedServiceApiKey;
};

const app = new Hono<{ Variables: AppVariables }>();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    credentials: true,
    allowHeaders: ["Content-Type", "x-api-key"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.get("/", (c) => {
  return c.json({
    name: "realtime-pricing-api",
    status: "ok",
  });
});

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

const pricesGateway = createInternalPricesGateway(upgradeWebSocket);

app.route("/auth", authRoutes);
app.route("/", marketDataRoutes);

app.get(
  "/ws/prices",
  async (c, next) => {
    const apiKey = c.req.header("x-api-key") ?? c.req.query("api_key");
    const serviceApiKey = apiKey ? await validateServiceApiKey(apiKey) : null;

    if (!serviceApiKey) {
      recordGatewayLog({
        source: "downstream",
        eventType: "auth_failed",
        message: "Rejected WebSocket connection with invalid API key",
        metadata: {
          hasApiKey: Boolean(apiKey),
        },
      });
      return c.json({ message: "Invalid API key" }, 401);
    }

    c.set("serviceApiKey", serviceApiKey);
    return next();
  },
  pricesGateway,
);

app.route("/", dashboardRoutes);

const port = Number(process.env.API_PORT ?? 8000);

const server = serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
  },
);

injectWebSocket(server);
