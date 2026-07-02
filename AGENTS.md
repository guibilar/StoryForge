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
- `shared/errors/` — `DomainError` (abstract base), `NotFoundError`,
  `ValidationError`.

Not yet implemented: a `Campaign` domain entity (only the Prisma model
exists today — see packages/database), Domain Events, Domain Services.

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

- Prisma schema (`Campaign` and `Entity` models only, so far)
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

---

## GraphQL layer (currently inside apps/api — packages/graphql not yet split out)

There is no standalone `packages/graphql` package yet. GraphQL currently
lives inside `apps/api`, and the `entities` module is fully wired end-to-end
(schema loads, resolvers call the service, mutations persist, domain errors
surface as proper GraphQL errors):

- `apps/api/src/graphql/` — server wiring: `server.ts` (graphql-yoga +
  node:http, passes `createContext` from `context.ts`), `schema.ts`
  (reads the central `schema/Root.graphql` off disk via `fs`, then merges
  it with each module's `typeDefs`/`resolvers` arrays into one
  `createSchema` call), `schema/Root.graphql` (the one and only
  `schema { query: Query mutation: Mutation }` block plus bare
  `type Query`/`type Mutation` — modules only ever `extend` these, never
  redeclare them), `context.ts` (builds `GraphQLContext`, including a
  module-scope singleton `entityService` handed to every request),
  `errors.ts` (`toGraphQLError` — maps `NotFoundError`/`ValidationError`
  to `GraphQLError` with an `extensions.code`, so resolvers don't leak
  masked "Unexpected error." responses).
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
- One vertical-slice module so far: `src/modules/entities/`, split into
  `application/` (`EntityService.ts` — create/update/delete/get/list
  use cases), `graphql/` (schema + resolvers, fully implemented —
  `createEntity`/`updateEntity`/`deleteEntity` mutations and
  `entity`/`entities` queries), and `infrastructure/`
  (`PrismaEntityRepository`, `EntityMapper`).
- `package.json` lists both `fastify`/`mercurius` and `graphql-yoga` as
  dependencies, but only `graphql-yoga` is wired up in code today.

Not yet implemented: authentication, a DI container, an event bus,
service registration/wiring beyond manual instantiation.

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

Write tests for:

- Domain entities
- Value Objects
- Services
- Compiler
- Plugin validation

Mock repositories.

Avoid mocking the domain.

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

- **Campaign** — the top-level container. Everything belongs to a
  Campaign. (Prisma model only; no `Campaign` domain entity yet.
- **Entity** — a single generic, polymorphic domain object with a
  `type: string` field (e.g. `"character"`, `"location"`, `"item"`,
  `"note"`) rather than separate Character/Location/Item/Note models.
  Has `name`, `description`, `icon`, `visibility`
  (`PUBLIC`/`STORYTELLER`/`PRIVATE`), soft delete (`deletedAt`), and a
  `(campaignId, name)` uniqueness constraint. Fully wired
  domain → service → Prisma repository; GraphQL resolvers are stubbed
  but not yet implemented (see apps/api notes above).

Not yet implemented, despite being referenced elsewhere in this
document as target scope: Users, Worlds, and dedicated
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
