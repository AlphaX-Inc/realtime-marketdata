FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV DATABASE_URL=postgresql://postgres:postgres@postgres:5432/realtime_pricing?schema=public
COPY . .
RUN pnpm db:generate
RUN pnpm build

FROM base AS api
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 8000
CMD ["node", "apps/api/dist/index.js"]

FROM base AS worker
ENV NODE_ENV=production
COPY --from=build /app /app
CMD ["node", "apps/api/dist/worker/index.js"]

FROM nginx:1.27-alpine AS frontend
COPY nginx.frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
