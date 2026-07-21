# syntax=docker/dockerfile:1
#
# Build context must be the monorepo root, e.g.:
#   docker build -f apps/web/Dockerfile -t storyforge-web .

FROM node:22-alpine AS base
RUN corepack enable

# ---- Prune the monorepo down to what the web app needs ----
FROM base AS pruner
WORKDIR /app
RUN pnpm add turbo
COPY . .
RUN pnpm exec turbo prune web --docker

# ---- Install deps and build the static bundle ----
FROM base AS builder
WORKDIR /app

COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json ./tsconfig.base.json
RUN pnpm turbo run build --filter=web

# ---- Serve the static bundle with nginx ----
FROM nginx:stable-alpine AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
