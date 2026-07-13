# StoryForge

[![CI](https://github.com/guibilar/StoryForge/actions/workflows/ci.yml/badge.svg)](https://github.com/guibilar/StoryForge/actions/workflows/ci.yml)

Modular tabletop RPG campaign management platform.

Generic core manages worlds, characters, notes, locations, timelines, items, and projects. RPG systems (Call of Cthulhu, Vampire, D&D, etc.) extend behavior via compile-time plugins.

Built with Domain Driven Design, Clean Architecture, event-driven domain model, GraphQL API, Prisma ORM, TypeScript.

## Stack

- TypeScript, pnpm workspaces, Turborepo
- API: Fastify/graphql-yoga (GraphQL)
- DB: Prisma
- Web: React (Vite)

## Repo layout

```
apps/
  api/         GraphQL server, modules/
  web/         React app

packages/
  database/    Prisma schema, client, repositories
  domain/      Campaign, Entity, User, CampaignMember, Tag, Relationship aggregates + shared errors

docs/
```

See `AGENTS.md` for full architecture rules, conventions, and current implementation state.

## Getting started

Requires pnpm.

```bash
pnpm install
pnpm dev     # turbo dev, all apps
pnpm build   # turbo build
pnpm lint
pnpm test
```

`packages/database` needs its own `.env` with `DATABASE_URL` set (see `packages/database/.env`).
`apps/api` needs its own `.env` with `JWT_SECRET` set.

`pnpm test` includes Prisma repository integration tests that hit the real database
at `DATABASE_URL` (no mocking) — a Postgres must be running and migrated
(`pnpm --filter @storyforge/database migrate:deploy`) before running tests locally.

## API testing

A Postman collection lives in `postman/` — `StoryForge.postman_collection.json` covers every
query/mutation (auth, campaigns, entities, tags) and `StoryForge.postman_environment.json` holds
`baseUrl`, `token`, and test IDs. Import both, run Auth > Login or Register first (it stores
the JWT in `{{token}}` automatically), then run the rest.

## Status

Early stage. `Campaign`, `Entity` (incl. image upload), `User` (auth), `CampaignMember`,
`Tag`, and `Relationship` are implemented full-stack (domain → service → Prisma repo → GraphQL). Auth guarding is
partial — see `AGENTS.md` "apps/api" section for which mutations require a logged-in user. Web
app is still default Vite scaffold. Plugin compiler and plugin packages not started.
