# StoryForge

[![CI](https://github.com/guibilar/StoryForge/actions/workflows/ci.yml/badge.svg)](https://github.com/guibilar/StoryForge/actions/workflows/ci.yml)

Modular tabletop RPG campaign management platform.

A generic core manages campaigns, entities (characters, locations, items, ...), tags,
relationships, notes with wiki-style links and attachments, sessions/timeline events, and
a Leaflet-based map with markers and territories linked back to entities. RPG systems
(Call of Cthulhu, Vampire, D&D, etc.) will extend behavior via compile-time plugins — not
yet started, see [Status](#status).

Built with Domain Driven Design, Clean Architecture, an event-driven domain model,
GraphQL API, Prisma ORM, and TypeScript throughout.

## Stack

- TypeScript, pnpm workspaces, Turborepo
- API: graphql-yoga on `node:http` (GraphQL), including GraphQL subscriptions
  over SSE for real-time features
- DB: Prisma + Postgres
- Web: React (Vite), `react-router-dom`, `urql`, `react-leaflet` (maps),
  `@xyflow/react` (relationship graph), `lucide-react` (icons)

## Repo layout

```
apps/
  api/         GraphQL server — src/modules/{auth,campaigns,campaignMembers,
               entities,tags,relationships,notes,noteLinks,attachments,
               sessions,events,map,campaignBroadcast,workspace}/, each split
               into application/ (services), graphql/ (schema + resolvers),
               infrastructure/ (Prisma repositories)
  web/         React app — routing, urql GraphQL client, full auth flow
               (login/register/dashboard), and the campaign desktop shell: a
               board of draggable/resizable windows (Members, Sessions,
               Timeline, Notes, Relationship Graph, Maps — all real, no
               placeholders left) with a global command palette (⌘K/Ctrl+K),
               named layout presets, and server-persisted per-user workspace
               state. See docs/FEATURES.md for the full checklist.

packages/
  database/    Prisma schema, generated client, DB connection
  domain/      Campaign, Entity, User, CampaignMember, Tag, Relationship, Note,
               NoteLink, Attachment, Session, Event aggregates + the
               role-based permission matrix + shared errors
  ui/          Shared React components (Button, Checkbox, CommandPalette,
               Form, Icon, IconButton, Input, Link, Modal, Select, Tabs,
               Textarea, Window) consumed by apps/web — thin scope, see
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

A Postman collection lives in `postman/` — `StoryForge.postman_collection.json` covers Auth,
Campaigns, Entities, Tags, Relationships, Campaign Members, Notes, Note Links, Attachments,
Sessions, and Events, plus a Cleanup folder. (Maps/Markers/Territories, the real-time
subscription mutations, and workspace state aren't in the collection yet.)
`StoryForge.postman_environment.json` holds `baseUrl`, `token`, and test IDs. Import both, run
Auth > Login or Register first (it stores the JWT in `{{token}}` automatically), then run the
rest.

## Status

API-first, well past early stage on the core (plugin system not started yet). Implemented
full-stack (domain → service → Prisma repository → GraphQL): `User` (auth), `Campaign`,
`CampaignMember`, `Entity` (incl. image upload and a per-entity map color override),
`Tag`, `Relationship` (incl. public/Storyteller-only/targeted visibility and per-endpoint
concealment, so an edge can point at a still-secret entity while staying visible with
that side redacted), `Note` (incl. nesting, wiki-style `NoteLink`s rendered as clickable
links client-side, and shared/private/targeted-handout visibility), `Attachment`,
`Session`, `Event` (incl. many-to-many participants via `EventParticipant`), and
Markers/Territories/a custom map image (plus JSON export/import of a geo campaign's
markers and territories) for the Leaflet-based Maps feature. Every campaign-scoped
resolver is guarded by a
role-based permission system (five roles — Owner, Storyteller, Co-Storyteller, Player,
Observer — mapped to actions in `packages/domain/src/permission`, including a
`BROADCAST_TO_PLAYERS` action gating Storyteller-only real-time pushes; Players/Observers
are read-only for world data and see only `PUBLIC`-visibility entities). Auth runs over
JWT as a Bearer header or an HttpOnly cookie (`login`/`registerUser` set it, `logout`
clears it). GraphQL subscriptions run over Server-Sent Events, backing two live
Storyteller-to-player push features: force-syncing a player's map viewport to the
Storyteller's, and force-opening an entity's window on a targeted player's screen.

The web app has a complete auth flow (register, login, dashboard — built on
`packages/ui`) and the campaign desktop shell: a per-campaign board of
draggable/resizable windows (Members, Sessions, Timeline, Notes, Relationship Graph, and
Maps are all real, role-aware content — no placeholder windows remain), a global
⌘K/Ctrl+K command palette with recently-opened-entity tracking, named layout presets, and
workspace state (layout + recents) persisted both to `localStorage` and, per user per
campaign, to the server. The generic `Entity` model can create/view/tag/relate/upload a
picture for anything (character, location, item, ...); it does not yet have a general
edit form for its name/type/description fields. The plugin compiler and RPG-system plugin
packages have not been started. See `docs/FEATURES.md` for the full checklist.
