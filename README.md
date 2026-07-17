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
- Web: React (Vite), `react-router-dom`, `urql` — early stage, see [Status](#status)

## Repo layout

```
apps/
  api/         GraphQL server — src/modules/{auth,campaigns,campaignMembers,entities,
               tags,relationships,notes,noteLinks,attachments,sessions,events}/, each
               split into application/ (services), graphql/ (schema + resolvers),
               infrastructure/ (Prisma repositories)
  web/         React app — routing, urql GraphQL client, full auth flow
               (login/register/dashboard), and the campaign desktop shell
               (KAN-80: draggable/resizable windows, dock, layout
               persistence, mobile tab fallback). NPCs and Members windows
               are real; Sessions/Timeline/Notes are placeholders, see
               docs/FEATURES.md

packages/
  database/    Prisma schema, generated client, DB connection
  domain/      Campaign, Entity, User, CampaignMember, Tag, Relationship, Note,
               NoteLink, Attachment, Session, Event aggregates + shared errors
  ui/          Shared React components (Button, Input, Form, Link, Modal,
               Window, Dock) consumed by apps/web — thin scope, see
               AGENTS.md "packages/ui"

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

Use `pnpm test:unit` to run everything except those integration tests (no
Postgres required) — this is what the Husky pre-commit hook runs. Use
`pnpm test:integration` to run just the Prisma repository tests. CI runs the
full `pnpm test` suite (unit + integration) against the `postgres:16` service
container.

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
query/mutation (auth, campaigns, entities, tags, relationships, notes, attachments, sessions,
events) and `StoryForge.postman_environment.json` holds `baseUrl`, `token`, and test IDs. Import
both, run Auth > Login or Register first (it stores the JWT in `{{token}}` automatically), then
run the rest.

## Status

Early stage, API-first. Implemented full-stack (domain → service → Prisma repository →
GraphQL): `User` (auth), `Campaign`, `CampaignMember`, `Entity` (incl. image upload),
`Tag`, `Relationship`, `Note` (incl. nesting and wiki-style `NoteLink`s), `Attachment`,
`Session`, and `Event` (incl. many-to-many participants via `EventParticipant`).
Every campaign-scoped resolver is guarded by a role-based permission system (KAN-61/62:
five roles — Owner, Storyteller, Co-Storyteller, Player, Observer — mapped to actions in
`packages/domain/src/permission`; Players/Observers are read-only for world data and see
only `PUBLIC`-visibility entities). Auth runs over JWT as a Bearer header or an HttpOnly
cookie (`login`/`registerUser` set it, `logout` clears it). The web app has a complete
auth flow (register, login, dashboard — built on `packages/ui`, KAN-75) and the campaign
desktop shell (KAN-80): a per-campaign board of draggable/resizable (KAN-88) windows with
a dock to reopen them, layout persisted to `localStorage`, and a single-panel tab fallback
below the mobile breakpoint. NPCs (KAN-39) and Members (KAN-81) are real windows with
role-aware CRUD; Sessions, Timeline, and Notes are still placeholders pending their own
tickets (KAN-84/49/85). The plugin compiler and RPG-system plugin packages have not been
started. See `docs/FEATURES.md` for the full checklist.
