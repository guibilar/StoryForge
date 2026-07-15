# StoryForge

[![CI](https://github.com/guibilar/StoryForge/actions/workflows/ci.yml/badge.svg)](https://github.com/guibilar/StoryForge/actions/workflows/ci.yml)

Modular tabletop RPG campaign management platform.

A generic core manages campaigns, entities (characters, locations, items, notes, ...),
tags, relationships, and notes with wiki-style links and attachments. RPG systems (Call
of Cthulhu, Vampire, D&D, etc.) will extend behavior via compile-time plugins — not yet
started, see [Status](#status).

Built with Domain Driven Design, Clean Architecture, an event-driven domain model,
GraphQL API, Prisma ORM, and TypeScript throughout.

## Stack

- TypeScript, pnpm workspaces, Turborepo
- API: Fastify/graphql-yoga (GraphQL)
- DB: Prisma + Postgres
- Web: React (Vite) — not built out yet, see [Status](#status)

## Repo layout

```
apps/
  api/         GraphQL server — src/modules/{auth,campaigns,campaignMembers,entities,
               tags,relationships,notes,noteLinks,attachments}/, each split into
               application/ (services), graphql/ (schema + resolvers), infrastructure/
               (Prisma repositories)
  web/         React app (default Vite scaffold, not started)

packages/
  database/    Prisma schema, generated client, DB connection
  domain/      Campaign, Entity, User, CampaignMember, Tag, Relationship, Note,
               NoteLink, Attachment aggregates + shared errors

docs/
```

See `AGENTS.md` for full architecture rules, module-by-module implementation detail,
and conventions for AI coding agents working on this repo.

## Getting started

Requires pnpm.

```bash
pnpm install
pnpm dev     # turbo dev, all apps
pnpm build   # turbo build
pnpm lint
pnpm test
```

`packages/database` needs its own `.env` with `DATABASE_URL` set.
`apps/api` needs its own `.env` with `JWT_SECRET` set.

`pnpm test` includes Prisma repository integration tests that hit the real database
at `DATABASE_URL` (no mocking) — a Postgres must be running and migrated
(`pnpm --filter @storyforge/database migrate:deploy`) before running tests locally.

## Docker

A full stack (Postgres, API, web) can be run with Docker Compose:

```bash
cp .env.example .env   # set JWT_SECRET and Postgres credentials
docker compose up --build
```

This builds `apps/api/Dockerfile` and `apps/web/Dockerfile`, runs Prisma migrations via a
one-off `migrate` service before the API starts, and serves the web app through nginx on
`WEB_PORT` (default `8080`), proxying `/graphql` and `/uploads` to the API. The API is also
exposed directly on `API_PORT` (default `4000`). Uploaded files and Postgres data persist in
named volumes (`api-uploads`, `postgres-data`).

The API image runs the server via `tsx` against TypeScript source rather than the `tsc` build
output — this repo's `moduleResolution: "Bundler"` setup emits extensionless relative imports
that plain Node's ESM loader can't resolve, so `tsx` (same as `pnpm dev`) is used instead.

## API testing

A Postman collection lives in `postman/` — `StoryForge.postman_collection.json` covers every
query/mutation (auth, campaigns, entities, tags, relationships, notes, attachments) and
`StoryForge.postman_environment.json` holds `baseUrl`, `token`, and test IDs. Import both, run
Auth > Login or Register first (it stores the JWT in `{{token}}` automatically), then run the
rest.

## Status

Early stage, API-first. Implemented full-stack (domain → service → Prisma repository →
GraphQL): `User` (auth), `Campaign`, `CampaignMember`, `Entity` (incl. image upload),
`Tag`, `Relationship`, `Note` (incl. nesting and wiki-style `NoteLink`s), and `Attachment`.
Auth guarding is partial — see `AGENTS.md` "apps/api" section for which mutations require
a logged-in user. The web app is still the default Vite scaffold — no real UI yet. The
plugin compiler and RPG-system plugin packages have not been started.
