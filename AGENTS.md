# AGENTS.md

> Development guide for AI coding agents working on StoryForge.
>
> This document defines the architectural rules, coding conventions, and development workflow. Unless explicitly instructed otherwise by the user, agents should follow these guidelines.

---

# Project Overview

StoryForge is a modular tabletop RPG campaign management platform.

It provides a generic core capable of managing worlds, characters, notes, locations, timelines, items, and projects while allowing RPG systems (Call of Cthulhu, Vampire, D&D, etc.) to extend behavior through a compile-time plugin architecture.

The project follows:

- Domain Driven Design (DDD)
- Clean Architecture
- Event-driven domain model
- GraphQL API
- Prisma ORM
- Compile-time plugin composition
- TypeScript everywhere

---

# Repository Structure

Current state (packages/apps that exist on disk today; see notes below for
what's still a stub or not yet started):

```
storyforge/

apps/
    api/                    GraphQL server (Fastify/graphql-yoga), modules/
    web/                    React app (still default Vite scaffold)

packages/
    core/                   empty — not started
    database/               Prisma schema, client, repositories live here
    domain/                 Entity aggregate + shared errors implemented
    plugin-sdk/             empty — not started
    shared/                 empty — not started
    ui/                     empty — not started
    vtm-plugin/             empty — not started (Vampire plugin placeholder)

docs/
    Roadmap/                empty
    sprints/                empty

docker/
.github/
```

Target/long-term structure (not fully realized yet — see gaps below):

```
storyforge/

apps/
    api/
    web/

packages/
    compiler/
    database/
    domain/
    graphql/
    plugin-sdk/
    shared/
    ui/

plugins/
    coc/
    vampire/
    dnd/

docs/
docker/
scripts/
.github/
```

Known gaps between target and current code:

- `packages/graphql` and `packages/compiler` do not exist yet. GraphQL
  schema/resolvers currently live directly inside `apps/api` (see
  `apps/api` section below). There is no compile-time plugin compiler yet.
- There is no top-level `plugins/` directory. `packages/vtm-plugin` is a
  placeholder for the future Vampire plugin but is currently empty.
- There is no `scripts/` directory.
- `packages/core`, `packages/plugin-sdk`, `packages/shared`, and
  `packages/ui` exist as workspace entries but contain no source yet.

---

# Core Principles

## 1. Domain First

Everything starts in the domain.

Never expose Prisma models directly.

Never expose database objects directly.

Business logic belongs inside the Domain package.

---

## 2. Infrastructure is replaceable

Database, GraphQL, Web UI and Plugins consume the domain.

The domain should never depend on:

- Prisma
- GraphQL
- Express
- React
- Next.js

---

## 3. Rich Domain Model

Entities contain behavior.

Avoid anemic models.

Prefer

```ts
character.rename(name);
character.moveTo(location);
project.archive();
```

instead of

```ts
character.name = name;
```

---

## 4. Explicit Use Cases

Business actions are implemented as Services / Use Cases.

Example

```
CreateProject
UpdateCharacter
CreateLocation
ArchiveWorld
MoveCharacter
```

---

# Packages

## packages/domain

Currently contains:

- `entity/` — the `Entity` aggregate (a generic, polymorphic domain object;
  see Current Canonical Core Features), `EntityId`, `EntityVisibility`,
  `EntityRepository` interface.
- `campaign/` — the `Campaign` aggregate, `CampaignId`, `CampaignRepository`
  interface. Holds `CampaignMember` value objects (add/remove/enumerate)
  and `Entity` list.
- `campaignMember/` — `CampaignMember` value object (userId + role), no
  own repository — persisted as part of the `Campaign` aggregate.
- `user/` — the `User` aggregate (email/password validation, `CreatedAt`/
  `UpdatedAt`/`Id`/`Email`/`Password` getters — password hashing itself is
  an application-layer concern, not domain), `UserId`, `UserRepository`
  interface.
- `tag/` (KAN-37) — the `Tag` aggregate (`campaignId` + `name`, normalized
  trim+lowercase on both `create()` and `rename()` so casing variants
  collide into one tag), `TagId`, `TagRepository` interface (includes
  `attachToEntity`/`detachFromEntity` — the `Tag`↔`Entity` join is managed
  through this repository rather than its own domain object, since
  `EntityTag` is a plain link with no behavior of its own).
- `shared/errors/` — `DomainError` (abstract base), `NotFoundError`,
  `ValidationError`, `AuthenticationError`.

Not yet implemented: Domain Events, Domain Services. No repository
implementations yet either (see packages/database — schema only).

Should contain (per architecture rules):

- Entities
- Value Objects
- Repositories (interfaces)
- Domain Services
- Events
- Errors

No external dependencies.

---

## packages/database

Contains:

- Prisma schema (`Campaign`, `CampaignMember`, `Entity`, `User`, `Tag`,
  `EntityTag` models so far — `Tag` is campaign-scoped with a
  `[campaignId, name]` unique constraint; `EntityTag` is the join table with
  a `[entityId, tagId]` unique constraint, KAN-37)
- Generated Prisma Client (checked into `src/generated/prisma`, custom
  output path set in `schema.prisma` — do not `export * from "@prisma/client"`
  from `index.ts`; that package has no generated code behind it and will
  crash on import)
- `client.ts` — Prisma client singleton. Loads `DATABASE_URL` from this
  package's own `.env` via an `import.meta.url`-anchored path, not the
  bare `dotenv/config` default (which resolves relative to the calling
  process's cwd, not this package's location — breaks when a consumer
  like `apps/api` runs from its own directory).

Repository implementations currently live in `apps/api` (see
`apps/api/src/modules/entities/infrastructure`), not in this package —
that's a deviation from the target architecture worth fixing as more
modules are added.

Never contains business logic.

Those `apps/api` repository implementations are integration-tested against
this package's real Prisma client and a live Postgres — see Testing section.

---

## GraphQL layer (currently inside apps/api — packages/graphql not yet split out)

There is no standalone `packages/graphql` package yet. GraphQL currently
lives inside `apps/api`, and the `entities`, `auth`, `campaigns`, and `tags`
modules are all fully wired end-to-end (schema loads, resolvers call the
service, mutations persist, domain errors surface as proper GraphQL errors):

- `apps/api/src/graphql/` — server wiring: `server.ts` (graphql-yoga +
  node:http, passes `createContext` from `context.ts`), `schema.ts`
  (reads the central `schema/Root.graphql` off disk via `fs`, then merges
  it with each module's `typeDefs`/`resolvers` arrays into one
  `createSchema` call), `schema/Root.graphql` (the one and only
  `schema { query: Query mutation: Mutation }` block plus bare
  `type Query`/`type Mutation` — modules only ever `extend` these, never
  redeclare them), `context.ts` (builds `GraphQLContext`, including
  module-scope singleton `entityService`/`authenticationService` handed to
  every request, plus a per-request `currentUserId: string | null` decoded
  off the `Authorization: Bearer <token>` header — a failed/missing token
  resolves to `null` rather than throwing, so resolvers decide what's
  protected, not the context builder), `errors.ts` (`toGraphQLError` —
  maps `NotFoundError`/`ValidationError`/`AuthenticationError` to
  `GraphQLError` with an `extensions.code` — `NOT_FOUND`/`BAD_USER_INPUT`/
  `UNAUTHENTICATED` respectively — so resolvers don't leak masked
  "Unexpected error." responses).
- `apps/api/src/modules/<module>/graphql/` — per-module schema
  (`schema/*.graphql`, only `extend type Query`/`extend type Mutation` +
  the module's own types/enums/inputs) and resolvers (`resolvers/Query.ts`,
  `resolvers/Mutation.ts`, `resolvers/<Type>.ts`), re-exported via an
  `index.ts` barrel that also reads its `.graphql` files off disk (via
  `import.meta.url`, since this is ESM and `.graphql` files aren't
  importable directly) and exports `typeDefs`/`resolvers` arrays for
  `schema.ts` to merge in.

As the API grows, expect this to be extracted into `packages/graphql`
per the target structure. Until then, new modules should follow the
same `modules/<name>/{application,graphql,infrastructure}` layout as
`modules/entities`, contribute their own `schema/*.graphql` +
`resolvers/`, and get merged into `apps/api/src/graphql/schema.ts`
alongside the entities module.

No business logic in resolvers. Resolvers call services; type-level field
resolvers (e.g. `modules/entities/graphql/resolvers/Entity.ts`) only
translate the domain object's getters into the GraphQL field shape
(e.g. `Date` → ISO string), never add business rules.

---

## packages/compiler (not started)

Not yet implemented. Described here for future reference —
responsible for compile-time plugin composition:

- Discover plugins
- Validate plugins
- Merge GraphQL schema
- Merge Prisma schema fragments
- Merge permissions
- Merge event handlers
- Merge UI extensions
- Generate registries
- Generate TypeScript
- Execute Prisma generation

Runs before build.

No runtime plugin loading.

---

## packages/plugin-sdk (not started)

Empty. Will contain types used by plugins.

Plugins depend on this package.

Core depends only on interfaces.

---

## packages/ui (not started)

Empty. Will contain shared React components:

- Design system
- Tables
- Forms
- Inputs
- Modals
- Layouts

---

## packages/shared (not started)

Empty. Will contain shared utilities:

- Result
- Either
- Date helpers
- IDs
- Logger interfaces

Avoid business logic.

---

## packages/core (not started)

Empty. Purpose not yet defined in code — do not assume its role; confirm
with the user before adding files here.

---

## packages/vtm-plugin (not started)

Empty placeholder for the future Vampire: The Masquerade plugin. No
plugin has been implemented yet, so treat the Plugin Architecture and
UI Extensions sections below as target design, not working code.

---

# Applications

## apps/api

Current implementation:

- GraphQL server via `graphql-yoga` on top of `node:http`
  (`src/graphql/server.ts`, `src/graphql/schema.ts`,
  `src/graphql/context.ts`, `src/graphql/errors.ts`). Fully wired and
  boots: `schema.ts` merges the central `Root.graphql` with the entities
  module's typeDefs/resolvers, `context.ts` injects a singleton
  `entityService` into every request, `errors.ts` maps domain errors to
  proper `GraphQLError`s. `src/index.ts` imports `./graphql/server`.
  `graphql` is pinned to `^16.x` in `package.json` — `graphql-yoga@5.x`
  only supports v15/v16 as a peer; do not bump to a v17 prerelease
  without confirming yoga supports it (a stray `^17` pin previously broke
  introspection's default arguments in confusing ways).
- Three vertical-slice modules so far (also `src/modules/campaigns/`,
  same layout, not detailed here):
  - `src/modules/entities/`, split into `application/` (`EntityService.ts`
    — create/update/delete/get/list use cases), `graphql/` (schema +
    resolvers, fully implemented — `createEntity`/`updateEntity`/
    `deleteEntity` mutations and `entity`/`entities` queries, all
    unguarded), and `infrastructure/` (`PrismaEntityRepository`,
    `EntityMapper`, `LocalImageStore`). Also owns image upload:
    `uploadEntityImage(entityId, file: Upload!)` mutation over the
    [GraphQL multipart request spec](https://github.com/jaydenseric/graphql-multipart-request-spec)
    (native `graphql-yoga` support, no extra deps) — the one entities
    mutation that _is_ guarded (`requireCurrentUser`).
    `LocalImageStore.save()` validates MIME type (JPEG/PNG/GIF/WEBP),
    filename length, and a 5MB size cap, then writes to
    `UPLOADS_DIR/<entityId>/<uuid>.<ext>` and returns that path as
    `Entity.image`. `UPLOADS_DIR` defaults to `<cwd>/uploads` if unset
    (`src/config/env.ts`).
  - `src/modules/campaigns/`, same layout: `application/`
    (`CampaignService.ts` — create/update/archive/list; `archiveCampaign`
    additionally requires an `OWNER`-role `CampaignMember` to exist, which
    is currently unreachable — see `CampaignMapper` gap below), `graphql/`
    (`createCampaign`/`updateCampaign`/`archiveCampaign` mutations, all
    guarded via `requireCurrentUser`; `campaigns`/`campaign(id)` queries,
    unguarded), `infrastructure/` (`PrismaCampaignRepository`,
    `CampaignMapper`).
  - `src/modules/auth/` (KAN-28), same layout: `application/`
    (`AuthenticationService.ts` — `register`/`login`, bcrypt hashing via
    `bcrypt-ts`, JWT issuance via `jsonwebtoken` with a minimal
    `{ sub: userId }` payload — full domain objects never go in the token),
    `graphql/` (`login`/`registerUser` mutations, `AuthPayload { token,
user }`), `infrastructure/` (`PrismaUserRepository`, `UserMapper`).
    Session strategy is JWT (stateless, no session table) — decided
    explicitly over server-side sessions and refresh-token pairs; revisit
    only if revocation-before-expiry becomes a real requirement.
  - `src/modules/tags/` (KAN-37), same layout: `application/`
    (`TagService.ts` — `addTagToEntity`/`removeTagFromEntity` (find-or-create
    the campaign-scoped `Tag` by normalized name, then idempotently
    attach/detach the `EntityTag` link), `listCampaignTags`, `listEntityTags`;
    takes both `TagRepository` and `EntityRepository` since it needs to
    resolve `campaignId` from `entityId` and validate the entity exists),
    `graphql/` (`addTagToEntity`/`removeTagFromEntity` mutations —
    unguarded, matching `createEntity`/`updateEntity`/`deleteEntity`, not
    `uploadEntityImage`'s `requireCurrentUser` — `campaignTags` query; plus
    `Entity.tags` field resolver added directly to
    `modules/entities/graphql/resolvers/Entity.ts`, the one `Entity` field
    that needs `context`), `infrastructure/` (`PrismaTagRepository`,
    `TagMapper`).
- `package.json` lists both `fastify`/`mercurius` and `graphql-yoga` as
  dependencies, but only `graphql-yoga` is wired up in code today.
- `JWT_SECRET` loaded via `src/config/env.ts` (fail-fast if unset) from
  `apps/api/.env`, itself loaded via Node's native `--env-file` flag
  (`package.json` `dev`/`dev:debug` scripts) or, for tests, `vitest.setup.ts`
  via `process.loadEnvFile` — no `dotenv` dependency. `.env` is gitignored;
  `.env.example` is the committed template; CI supplies `JWT_SECRET` as a
  workflow env var instead (see Testing section).

Not yet implemented: a DI container, an event bus, service
registration/wiring beyond manual instantiation. Auth gating is now
partially wired: `requireCurrentUser` (`modules/auth/graphql/guards.ts`)
throws `AuthenticationError` when `context.currentUser` is null, and is
called at the top of `createCampaign`/`updateCampaign`/`archiveCampaign`
and `uploadEntityImage`. It is _not_ applied consistently — `createEntity`/
`updateEntity`/`deleteEntity` and every query resolver (`entity`/
`entities`/`campaign`/`campaigns`/`campaignTags`) remain unguarded. Treat
this as inconsistent-by-history, not intentional design, when adding new
mutations.

No business logic belongs here — resolvers call services, services call
repositories.

---

## apps/web

Currently the default Vite + React scaffold (`App.tsx`, default
`vite.svg`/`react.svg` assets) — no real UI, pages, or GraphQL client
have been built yet.

Target responsibilities (not yet realized):

- React application
- Pages
- UI extension rendering
- GraphQL client

No business logic.

---

# Plugin Architecture

Plugins represent RPG systems only.

Examples

- Call of Cthulhu
- Vampire
- D&D

Plugins cannot modify core features.

Plugins extend the application through predefined extension points.

Plugins contribute:

- Prisma schema fragments
- GraphQL schema
- Event handlers
- Character sheets
- UI tabs
- Sidebar widgets
- Dashboard widgets
- Permissions
- Seed data

---

# UI Extensions

Plugins may contribute UI only through approved extension points.

Examples

```
Character tabs

Inventory tab

Stats tab

Magic tab
```

```
Dashboard widgets

Recent rolls

Sanity tracker

XP tracker
```

```
Sidebar widgets

Session tools

Combat tracker

Investigation clues
```

Plugins cannot replace existing pages.

Plugins cannot alter navigation.

Plugins cannot inject arbitrary React components.

All extensions are registered by the compiler.

---

# Events

Communication between Core and Plugins happens using Domain Events.

Example

```
CharacterCreated
CharacterDeleted
CharacterMoved
SessionStarted
ItemCreated
DiceRolled
```

Core emits events.

Plugins subscribe.

Plugins may emit their own events.

Avoid direct coupling between modules.

---

# Event Rules

Events are immutable.

Example

```ts
interface CharacterCreated {
  characterId: string;

  projectId: string;

  occurredAt: Date;
}
```

Never mutate events.

---

# Repository Rules

Repositories are interfaces.

Example

```ts
interface CharacterRepository {
  save(character: Character);

  findById(id: CharacterId);
}
```

Prisma implementations live inside packages/database.

---

# GraphQL Rules

Resolvers should be thin.

GOOD

```
Resolver

↓

Use Case

↓

Repository

↓

Domain
```

BAD

```
Resolver

↓

Prisma

↓

Business Logic
```

---

# Entity Rules

Entities own state.

Use methods.

Prefer

```ts
character.rename(...)
```

instead of

```ts
character.props.name = ...
```

---

# IDs

Always use Value Objects.

Avoid raw strings.

Example

```ts
CharacterId;

ProjectId;

WorldId;
```

---

# Errors

Use domain errors.

Example

```
CharacterAlreadyExists

WorldArchived

ProjectNotFound

InvalidCharacterName
```

Avoid throwing generic Error.

---

# Result Pattern

Prefer

```ts
Result<T, Error>;
```

instead of exceptions for business failures.

---

# Dependency Direction

Allowed

```
Web

↓

GraphQL

↓

Services

↓

Repositories

↓

Database
```

Domain remains independent.

---

# Compiler Workflow

```
Load plugins

↓

Validate manifests

↓

Merge schemas

↓

Merge GraphQL

↓

Merge permissions

↓

Generate registry

↓

Generate Prisma schema

↓

Prisma Generate

↓

Application Build
```

No runtime schema merging.

---

# Naming

Classes

```
Character

Project

Location
```

Interfaces

```
CharacterRepository

PluginDefinition

EventHandler
```

Services

```
CreateCharacterService

DeleteLocationService

ArchiveProjectService
```

Events

```
CharacterCreated

ProjectArchived

DiceRolled
```

---

# Code Style

Prefer composition.

Avoid inheritance unless justified.

Keep functions small.

Prefer immutable data.

Avoid static state.

Use strict TypeScript.

Avoid `any`.

---

# Tooling

Pre-commit hooks are wired via Husky: `.husky/pre-commit`, `core.hooksPath`
set to `.husky/_`, `prepare: "husky"` in root `package.json`. The hook runs
`pnpm test` then `pnpm lint-staged` — the latter isn't a defined root
script, but `pnpm` resolves it straight from `node_modules/.bin`. `lint-staged`
config (root `package.json`) runs `eslint --fix` + `prettier --write` on
staged `*.{js,ts,tsx,jsx}` and `prettier --write` on staged `*.{json,md}`, so
a lint/format violation is blocked locally before it reaches CI.

---

# Testing

Vitest, wired per-package (`packages/domain`, `apps/api`; each has its own
`test` script, `turbo.json`'s `test` task runs them via `dependsOn: ["^build"]`
so workspace deps are built first). Current coverage (153 tests):

- **Domain unit tests** (`packages/domain/src/**/*.test.ts`) — `Campaign`,
  `Entity`, `CampaignMember`, `User`, `Tag`, `Id`, `DomainError` subclasses.
  Pure logic, no mocks, no I/O.
- **Application service tests** (`apps/api/src/modules/*/application/*.test.ts`)
  — `CampaignService`, `EntityService`, `AuthenticationService`, `TagService`
  against hand-rolled `vi.fn()` mocks of the repository interfaces (`TagService`
  mocks both `TagRepository` and `EntityRepository`). `AuthenticationService`
  uses real `bcrypt-ts`/`jsonwebtoken` (not mocked) so the token roundtrip is
  actually verified, not assumed.
- **Mapper tests** (`apps/api/src/modules/*/infrastructure/*Mapper.test.ts`)
  — `toDomain`/`toPersistence` roundtrips against literal Prisma-shaped
  records.
- **Prisma repository integration tests**
  (`apps/api/src/modules/*/infrastructure/Prisma*Repository.test.ts`) — hit a
  **real** Postgres (the same one `DATABASE_URL` points at — locally that's
  the `my-postgres` docker container, in CI it's the `postgres:16` service
  container declared in `.github/workflows/ci.yml`), not a mock. Each test
  creates its own rows (unique names/emails via `randomUUID()`) and deletes
  them in `afterEach` — no test database/schema isolation exists yet, so
  cleanup discipline is load-bearing; don't add a test that skips it.

Mock repositories for service tests. Avoid mocking the domain. Don't mock
Prisma for repository tests — that's what the integration layer above is for.

Gotchas learned building this out, worth knowing before adding more:

- `apps/api/vitest.setup.ts` loads `apps/api/.env` for `JWT_SECRET` via
  Node's native `process.loadEnvFile` — wrapped in try/catch for `ENOENT`
  since `.env` doesn't exist in CI (env vars come from the workflow's `env:`
  block instead).
- Turborepo v2 defaults to **strict env mode** — it strips env vars from a
  task's child process unless the task declares them in `turbo.json`. Both
  `DATABASE_URL` and `JWT_SECRET` are declared under the `test` task's `env`
  array for exactly this reason; a run that works locally (real `.env` files
  present) can still fail in CI if a new required env var isn't added there
  too.
- `tsconfig.json` in `apps/api` and `packages/domain` excludes
  `src/**/*.test.ts` from the build (`tsc`) output. Without that exclude,
  `dist/**/*.test.js` gets emitted, and since Vitest v4's default `exclude`
  is just `node_modules`/`.git` (no longer `dist`), every test ran twice —
  once from `src`, once from the stale `dist` copy with no way to load env
  files relative to it.

No test infra yet for `apps/web` (still the Vite scaffold) or the compiler
(not started).

---

# AI Agent Guidelines

When implementing features:

1. Start with the domain.
2. Create Value Objects if necessary.
3. Implement Entity behavior.
4. Define repository interfaces.
5. Implement the service/use case.
6. Add domain events.
7. Implement Prisma repositories.
8. Expose via GraphQL.
9. Render in the web application.
10. Add tests.

Never begin with the database schema unless specifically requested.

---

# Things Agents Must NOT Do

Do NOT:

- Put business logic in GraphQL resolvers.
- Put business logic in React components.
- Make the domain depend on Prisma.
- Use runtime plugin discovery.
- Allow plugins to modify navigation.
- Expose Prisma models outside the database package.
- Bypass services to access repositories directly from GraphQL.
- Use mutable domain events.
- Use raw string IDs.
- Introduce circular dependencies between packages.

---

# Preferred Development Order

For every new feature:

1. Domain
2. Service
3. Repository interface
4. Domain Event
5. Database implementation
6. GraphQL
7. UI
8. Tests

---

# Current Canonical Core Features

The core application currently implements only:

- **Authentication** — `User` aggregate + `AuthenticationService`
  (register/login, bcrypt hashing, JWT issuance), wired end-to-end through
  `login`/`registerUser` GraphQL mutations (KAN-28), plus a `me` query
  (`context.currentUser`, resolves to `null` when logged out). Gating via
  `requireCurrentUser` now protects `createCampaign`/`updateCampaign`/
  `archiveCampaign` and `uploadEntityImage` — see apps/api notes above for
  which resolvers remain unguarded.
- **Campaign** — the top-level container. Everything belongs to a
  Campaign. Domain entity + `CampaignService` (create/update/archive,
  KAN-29) now implemented, same domain → service → Prisma repository
  shape as Entity. GraphQL resolvers (`campaign`, `campaigns`,
  `createCampaign`, `updateCampaign`, `archiveCampaign`) wired. Known
  gap: `CampaignMapper.toDomain` never hydrates `campaignMembers`
  (always `[]`), so `archiveCampaign`'s no-owner check always fails.
- **Entity** — a single generic, polymorphic domain object with a
  `type: string` field (e.g. `"character"`, `"location"`, `"item"`,
  `"note"`) rather than separate Character/Location/Item/Note models.
  Has `name`, `description`, `icon`, `image`, `visibility`
  (`PUBLIC`/`STORYTELLER`/`PRIVATE`), soft delete (`deletedAt`), and a
  `(campaignId, name)` uniqueness constraint. Fully wired
  domain → service → Prisma repository → GraphQL: `createEntity`/
  `updateEntity`/`deleteEntity`/`uploadEntityImage` mutations,
  `entity`/`entities` queries (see apps/api notes above for image
  upload details).
- **Tags** (KAN-37) — campaign-scoped `Tag` aggregate, reusable across
  entities in the same campaign via the `EntityTag` join. Fully wired
  domain → service → Prisma repository → GraphQL: `addTagToEntity`/
  `removeTagFromEntity` mutations, `campaignTags` query, `Entity.tags`
  field.

Not yet implemented, despite being referenced elsewhere in this
document as target scope: Worlds, and dedicated
Character/Location/Item/Note models. Until those exist (or a decision
is made to keep the generic `Entity` model permanently), treat any
guidance elsewhere in this file that assumes separate entity types as
aspirational, and prefer extending the generic `Entity`/`type` pattern
for consistency unless the user directs otherwise.

---

# Canonical Plugin Scope

Plugins are currently limited to RPG systems.

Examples:

- Call of Cthulhu
- Vampire: The Masquerade
- Dungeons & Dragons

Infrastructure concerns such as logging, search indexing, analytics, notifications, and authentication remain part of the core application and are not implemented as plugins.

---

# Long-Term Goals

The architecture should prioritize:

- Maintainability over short-term speed.
- Explicit dependencies over magic.
- Compile-time validation over runtime failures.
- Strong typing over dynamic behavior.
- Stable extension points over unrestricted customization.
- Domain correctness over ORM convenience.

When in doubt, preserve these principles rather than introducing shortcuts.
