# syntax=docker/dockerfile:1
#
# Build context must be the monorepo root, e.g.:
#   docker build -f apps/api/Dockerfile -t storyforge-api .
#
# Runs the API through `tsx` against TypeScript source rather than the
# `tsc` build output: this repo's tsconfig uses "moduleResolution": "Bundler"
# with extensionless relative imports, which plain Node's ESM loader cannot
# resolve (ERR_MODULE_NOT_FOUND). `tsx` resolves them the same way `pnpm dev`
# already does, so this mirrors the working dev setup instead of introducing
# a separate, untested execution path.

FROM node:22-alpine AS base
RUN corepack enable

# ---- Prune the monorepo down to what @storyforge/api needs ----
FROM base AS pruner
WORKDIR /app
RUN pnpm add -g turbo
COPY . .
RUN turbo prune @storyforge/api --docker

# ---- Install deps and build workspace dependencies ----
FROM base AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install from the pruned lockfile/package.json set first for layer caching.
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile --ignore-scripts

# Bring in the pruned source. turbo prune doesn't capture root config files
# that are only referenced via relative "extends" paths, so copy it in too.
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json ./tsconfig.base.json

# The Prisma client is generated into packages/database/src/generated and is
# imported by source, so it must exist before anything runs. A DATABASE_URL
# value is required to load prisma.config.ts but isn't connected to here.
ARG DATABASE_URL=postgresql://user:password@localhost:5432/storyforge
RUN pnpm --filter @storyforge/database run generate

# @storyforge/domain is consumed via its built dist/ (see its package.json
# "main"); @storyforge/database is consumed straight from source.
RUN pnpm turbo run build --filter=@storyforge/domain

# ---- Production runtime image ----
FROM base AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 storyforge

COPY --from=installer /app .
RUN mkdir -p /app/apps/api/uploads && chown -R storyforge:nodejs /app

USER storyforge
ENV NODE_ENV=production
ENV UPLOADS_DIR=/app/apps/api/uploads
WORKDIR /app
EXPOSE 4000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node_modules/.bin/tsx", "apps/api/src/index.ts"]
