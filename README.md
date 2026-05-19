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
{ "type": "subscribe", "symbols": ["AAPL", "MSFT"] }
```

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

## Production Compose

`docker-compose.yml` builds three app targets:

- `frontend`: nginx serving the Vite build on host port `3000`
- `api`: Hono API on host port `8000`
- `worker`: Twelve Data market-data worker

Required production environment:

```sh
API_KEY_ENCRYPTION_SECRET="base64-encoded-32-byte-key"
TWELVEDATA_API_KEY="your-twelve-data-key"
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
```

Run:

```sh
docker compose up --build -d
```

The `migrate` service runs `prisma migrate deploy` before the API and worker start.
