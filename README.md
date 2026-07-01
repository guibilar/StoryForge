# StoryForge

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
  core/        (empty, not started)
  database/    Prisma schema, client, repositories
  domain/      Entity aggregate + shared errors
  plugin-sdk/  (empty, not started)
  shared/      (empty, not started)
  ui/          (empty, not started)
  vtm-plugin/  (empty, Vampire plugin placeholder)

docs/
docker/
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

## Status

Early stage. Only `Campaign` (Prisma model) and `Entity` (full domain → service → repo → GraphQL) exist today. Web app is still default Vite scaffold. Plugin compiler not started.
