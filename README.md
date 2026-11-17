# Realtime Pricing

Monorepo boilerplate with:

- `apps/api`: Hono API on Node
- `apps/frontend`: React + Vite + TanStack Router file routes + TanStack Query
- `packages/db`: Prisma + PostgreSQL driver adapter
- `packages/ui`: shadcn-style shared UI components
- root Biome config
- Docker Compose services for Postgres and Redis on non-default host ports

## Development

```sh
pnpm install
cp .env.example .env
docker compose -f docker-compose.dev.yaml up -d
pnpm db:deploy
pnpm db:generate
pnpm dev
```

The default local URLs are:

- Frontend: `http://localhost:3000`
- API: `http://localhost:8000`
- Browser API proxy: `http://localhost:3000/api`
- Browser WebSocket proxy: `ws://localhost:3000/ws/prices`
- Postgres host port: `55432`
- Redis host port: `56379`

## Scripts

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm db:deploy
pnpm db:migrate
pnpm db:studio
pnpm --filter @realtime-pricing/api dev:worker
pnpm --filter @realtime-pricing/api test
```

## Market Data Gateway

The API exposes an internal WebSocket endpoint at `ws://localhost:8000/ws/prices`.
The frontend dev server and production nginx also proxy it at `ws://localhost:3000/ws/prices`.

Send:

```json
{ "type": "subscribe", "symbols": ["AAPL", "MSFT", "TSE:7203"] }
```

US symbols use the Twelve Data WebSocket path. TSE symbols are normalized onto the same
`/ws/prices` response shape by polling J-Quants REST only while those symbols are subscribed.
Accepted TSE formats are `TSE:7203`, `7203.T`, and `72030.T`.

Historical bars and option chains are exposed as REST endpoints using the same service API key
authentication. `/ohlc` is the preferred cached multi-symbol endpoint. Missing symbols are
backfilled from January 1, 2025, then served from Postgres on later requests. `/daily-ohlc` remains
available for single-symbol compatibility. Manual `/stock-splits` adjustments are applied to cached
historical OHLC before the adjustment date and are reflected by the existing OHLC endpoints.

```sh
curl -H "x-api-key: <api-key>" \
  "http://localhost:8000/ohlc?symbols=AAPL,NVDA,TSE:7203&from=2025-12-01&to=2025-12-05"

curl -H "x-api-key: <api-key>" \
  "http://localhost:8000/daily-ohlc?symbol=TSE:7203&from=2025-12-01&to=2025-12-05"

curl -H "x-api-key: <api-key>" \
  "http://localhost:8000/options?market=JP&symbol=2914&date=2025-12-01"

curl -H "x-api-key: <api-key>" \
  "http://localhost:8000/options?market=US&symbol=IBM&date=2017-11-15"

curl -H "x-api-key: <api-key>" \
  "http://localhost:8000/stock-splits?symbols=KLAC&from=2025-01-01&to=2026-06-17"

curl -X POST -H "content-type: application/json" -H "x-api-key: <api-key>" \
  -d '{"symbol":"KLAC","adjustmentDate":"2026-06-12","ratioFrom":"1","ratioTo":"10"}' \
  "http://localhost:8000/stock-splits"
```

US and JP options responses are cached by market, symbol, date, and contract ID.

## Bigdata.com MCP proxy

`/bigdata/mcp` is a caching proxy for the [Bigdata MCP](https://docs.bigdata.com/mcp-reference/introduction)
server (`BIGDATA_MCP_URL`, default `https://mcp.bigdata.com/`). Point an existing MCP client at it
in place of `https://mcp.bigdata.com/` and keep sending the same `Authorization: Bearer <bigdata-key>`
header. The token is forwarded upstream as-is; no service API key is needed.

MCP URL for your client:

| Where the API runs | MCP URL |
| --- | --- |
| Local dev | `http://localhost:8000/bigdata/mcp` |
| Docker compose host | `http://<host>:${API_PORT:-8000}/bigdata/mcp` |
| Deployed | `https://<your-api-domain>/bigdata/mcp` |

Use your `API_PORT` value if it isn't `8000`. The only header the client needs is
`Authorization: Bearer <bigdata-key>`. Browser-based clients also need `Authorization`,
`mcp-session-id`, and `mcp-protocol-version` added to `allowHeaders` in the CORS setup in
`apps/api/src/index.ts`. Server-side clients don't.

To check it works, make the same tool call twice. The `x-bigdata-cache` response header should
read `MISS` the first time and `HIT` the second.

Every `tools/call` through the proxy is logged (tool, `HIT`/`MISS`/`BYPASS`, status, duration,
a fingerprint of the Bearer token, and the first 300 characters of the arguments). Dashboard →
**Bigdata** shows 24-hour totals, a per-tool breakdown, and recent calls. Logs are kept for 7 days
and are left out of the main Logs page.

The Reason column on recent calls says why a call failed (HTTP status with the upstream body, tool
error text, JSON-RPC error, unreadable reply, aborted, or proxy exception) or, for a successful
`MISS`, why nothing was cached: new arguments or caller, an earlier identical call failed, the entry
expired after 24 hours, a concurrent duplicate, or the cache was lost (Redis flushed or restarted).
`BYPASS` calls stream straight through, so only their HTTP failures are detected.

```sh
curl -i -X POST -H "Authorization: Bearer <bigdata-key>" \
  -H "Accept: application/json, text/event-stream" -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_securities","arguments":{"query":"NVDA"}}}' \
  "http://localhost:8000/bigdata/mcp"
```

`tools/call` results for the stateless data tools (`find_securities`, `bigdata_search`, the
tearsheets, and so on, listed in `cachedMcpTools`) are cached in Redis under `bigdata:cache:*` for
24 hours. The cache key covers the tool name, the arguments (key order ignored), and the Bearer
token, so different tokens never share cached results. Tool errors and failed responses are not
cached. Every other request passes straight through: `initialize`, `tools/list`, notifications,
SSE streams, and account-state tools such as watchlists or monitors. The `x-bigdata-cache: HIT|MISS`
response header marks cacheable calls.

Run the worker separately so it owns the single Twelve Data upstream connection:

```sh
docker compose -f docker-compose.dev.yaml up -d redis
pnpm --filter @realtime-pricing/api dev
pnpm --filter @realtime-pricing/api dev:worker
```

## Dashboard

Set these environment variables before starting the API:

```sh
DATABASE_URL="postgresql://postgres:postgres@localhost:55432/realtime_pricing?schema=public"
API_KEY_ENCRYPTION_SECRET="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
```

Then open `http://localhost:3000/register` to create the first admin account. Public
registration closes after the first user; additional users are created from the dashboard.

Locked out (can't log in as any admin)? Create a new admin from the server. It never modifies
existing users and reads the password from stdin:

```sh
pnpm build && pnpm create-admin you@example.com "Your Name"

# prod (on the VM, after ./update.sh)
sudo systemd-run --pty --wait --quiet \
  -p User=marketdata -p WorkingDirectory=/opt/realtime-marketdata/current \
  -p EnvironmentFile=/etc/realtime-marketdata/runtime.env \
  -p EnvironmentFile=/etc/realtime-marketdata/deployment.env \
  node apps/api/dist/scripts/create-admin.js you@example.com "Your Name"
```

## Production Compose

`docker-compose.yml` builds three app targets:

- `frontend`: nginx serving the Vite build on host port `3000`
- `api`: Hono API on host port `8000`
- `worker`: Twelve Data market-data worker

Required production environment:

```sh
API_KEY_ENCRYPTION_SECRET="base64-encoded-32-byte-key"
TWELVEDATA_API_KEY="your-twelve-data-key"
JQUANTS_API_KEY="your-jquants-key"
ALPHAVANTAGE_API_KEY="your-alpha-vantage-key"
```

Optional overrides:

```sh
FRONTEND_PORT=3000
API_PORT=8000
FRONTEND_ORIGIN="http://localhost:3000"
VITE_API_BASE_URL="/api"
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=realtime_pricing
DAILY_OHLC_RECENT_REFRESH_MARKET_DAYS=3
DAILY_OHLC_RECENT_REFRESH_TTL_MS=7200000
```

Run:

```sh
docker compose up --build -d
```

The `migrate` service runs `prisma migrate deploy` before the API and worker start.
