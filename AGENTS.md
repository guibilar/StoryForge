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
    api/                    GraphQL server (graphql-yoga), 11 vertical-slice
                            modules — see apps/api below
    web/                    React app — auth flow, dashboard, campaign
                            desktop shell — see apps/web below

packages/
    core/                   empty — not started
    database/               Prisma schema, client (repository implementations
                            live in apps/api — see below)
    domain/                 aggregates for every module (see packages/domain
                            below) + permission matrix + shared errors
    plugin-sdk/             empty — not started
    shared/                 empty — not started
    ui/                     shared React components (Button, Input, Form, Link,
                             Modal, Window, Dock) + Storybook — see packages/ui
    vtm-plugin/             empty — not started (Vampire plugin placeholder)

docs/
    FEATURES.md             feature checklist, kept in sync with built code

docker-compose.yml          full local stack (Postgres, migrate, API, web)
apps/api/Dockerfile, apps/web/Dockerfile
postman/                    Postman collection covering the whole API
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
- There is no `scripts/` directory, and no `docker/` directory — Docker
  files live at the repo root (`docker-compose.yml`) and inside each app.
- `packages/core`, `packages/plugin-sdk`, and `packages/shared` exist as
  workspace entries but contain no source yet. `packages/ui` (KAN-75) now
  has real source — see below, this bullet is stale for that one package.

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
  interface. `User.validatePlainPassword(raw)` (static) holds the raw
  password rules — the instance-level validation only ever sees the bcrypt
  hash (always 60 chars, passes every length rule), so any caller that
  hashes a user-supplied password must run the static validator against
  the raw input first. `AuthenticationService.register` does exactly that.
- `tag/` (KAN-37) — the `Tag` aggregate (`campaignId` + `name`, normalized
  trim+lowercase on both `create()` and `rename()` so casing variants
  collide into one tag), `TagId`, `TagRepository` interface (includes
  `attachToEntity`/`detachFromEntity` — the `Tag`↔`Entity` join is managed
  through this repository rather than its own domain object, since
  `EntityTag` is a plain link with no behavior of its own).
- `relationship/` (KAN-40/41) — the `Relationship` aggregate (directed
  entity→entity edge, validated free-string `type`, soft delete, blocks
  self-relationships), `RelationshipId`, `RelationshipRepository`.
- `note/` (KAN-43/46) — the `Note` aggregate (`campaignId`/`authorId`,
  title/content, soft delete, `ParentNoteId` + `moveTo` for nesting),
  `NoteId`, `NoteRepository`.
- `noteLink/` (KAN-45) — the `NoteLink` value object (note → entity or
  note target), `NoteLinkId`, `NoteLinkRepository`.
- `attachment/` (KAN-44) — the `Attachment` aggregate (note-scoped file
  metadata, image mime-type allowlist), `AttachmentId`,
  `AttachmentRepository`.
- `session/` (KAN-47) — the `Session` aggregate (per-campaign
  auto-numbered, date + optional summary), `SessionId`,
  `SessionRepository`.
- `event/` (KAN-48) — the `Event` aggregate (timeline event, optional
  session link, `occurredAt`), `EventId`, `EventRepository`.
- `permission/` (KAN-62) — the role-based permission matrix:
  `hasPermission(role, action)` over a `CampaignRole → PermissionAction`
  map (`VIEW_ENTITY`, `EDIT_ENTITY`, `MANAGE_MEMBERS`,
  `MANAGE_CAMPAIGN_SETTINGS`), plus `canViewVisibility`/
  `filterByVisibility` for the Player/Observer read path. Framework-free —
  consumed by the apps/api guards.
- `shared/errors/` — `DomainError` (abstract base), `NotFoundError`,
  `ValidationError`, `AuthenticationError`, `ForbiddenError`.

Not yet implemented: Domain Events, Domain Services. Repository
implementations live in `apps/api` (see packages/database).

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
  module-scope singleton services handed to every request, plus per-request
  `currentUserId`/`currentUser` decoded off the `Authorization: Bearer
<token>` header or, failing that, the HttpOnly `token` cookie
  (`cookies.ts` — set by `login`/`registerUser` via `setAuthCookie`,
  cleared by `logout`; `SameSite=Lax`, `Secure` in production, 8h
  `Max-Age` matching the JWT expiry). A failed/missing token resolves to
  `null` rather than throwing, so resolvers decide what's protected, not
  the context builder), `errors.ts` (`toGraphQLError` — maps
  `NotFoundError`/`ValidationError`/`AuthenticationError`/`ForbiddenError`
  to `GraphQLError` with an `extensions.code` — `NOT_FOUND`/
  `BAD_USER_INPUT`/`UNAUTHENTICATED`/`FORBIDDEN` respectively — so
  resolvers don't leak masked "Unexpected error." responses),
  `dateInput.ts` (`parseRequiredDate`/`parseOptionalDate` — every
  date-string GraphQL argument goes through these; they reject `null` and
  unparseable strings as `ValidationError` instead of letting
  `new Date(null)` silently coerce to the 1970 epoch or an Invalid Date
  reach Prisma as a masked internal error), and `uploadsStaticHandler.ts`
  (serves `GET /uploads/*` off `UPLOADS_DIR` outside GraphQL —
  path-traversal-safe, tolerates malformed percent-encoding and query
  strings; note these URLs are unauthenticated by design so far).
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

## packages/ui (KAN-75/KAN-31/KAN-80 — thin scope: Button, Input, Form, Link, Modal, Window, Dock; plus Storybook)

`@storyforge/ui`, consumed by `apps/web` today. Deliberately not a full
design system yet — built to exactly what each landed ticket needed
(KAN-31 auth + campaign screens, KAN-80 desktop shell), per KAN-75's DoD
("not a speculative component library built ahead of need"). Tables are
still unbuilt — both the Members (KAN-81) and NPCs (KAN-39) list views
shipped as plain `<ul>` lists instead, matching current scale; pick a
Table up when a window's list actually needs it.

**No build step.** `main`/`types` point straight at `src/index.ts` (no
`dist/`), same "just-in-time package" pattern as `packages/database` —
Vite in `apps/web` transforms the TSX/CSS-Modules source directly. No
`build` script in `package.json`; `turbo build` skips it. Has its own
`lint`, `test` (Vitest + Testing Library, mirrors `apps/web`'s config),
and `typecheck` (`tsc --noEmit`) scripts, all wired into the root
`pnpm turbo run lint build test` (CI runs this — see Testing section).
Storybook is set up (`.storybook/`, `*.stories.tsx` per component;
`pnpm --filter @storyforge/ui storybook` on port 6006) for developing
components in isolation — not part of the CI pipeline.

**Styling: CSS Modules on CSS-custom-property tokens**, not Tailwind,
not a headless lib like Radix (yet). Every component's `.module.css`
only ever references `var(--accent)` etc. — never a hardcoded color.

**Theming**: `src/tokens/tokens.css` (exposed via the `./tokens.css`
subpath export) defines the palette as `[data-theme="light"]` /
`[data-theme="dark"]` attribute blocks, with `prefers-color-scheme` as
the fallback when no `data-theme` is set on the document. This is the
mechanism that used to live directly in `apps/web/src/index.css`
(same custom-property names, moved not renamed). Adding a third named
palette later is purely additive — one more `[data-theme="..."]` block
in that one file, zero component changes. No theme-switcher UI exists
yet (out of scope for KAN-75) — a future one just needs
`document.documentElement.setAttribute("data-theme", "...")`.

**Components** (`src/components/`, one directory each, barrel-exported
from `src/index.ts`):

- `Button` — native `<button>` props + `variant?: "primary" | "secondary"`.
- `Input` — native `<input>` props + `invalid?: boolean` (sets `aria-invalid` + error styling).
- `Form` family (`src/components/Form/`) — `Form` (styled `<form>`), `Label`,
  `FormField` (`{label, htmlFor, error?, children}`, wires label/input/error
  association), `FormError` (form-level error banner). Not a form-state
  library — no react-hook-form, this is markup only.
- `Link` — polymorphic via a plain `as?: ElementType` prop (default `"a"`),
  no `react-router-dom` dependency in this package itself. Consumers do
  `<Link as={RouterLink} to="/x">` in `apps/web`.
- `Modal` — wraps a native `<dialog>` (`open`/`onClose` props). Calls
  `showModal()`/`close()` imperatively via a ref when available, falling
  back to toggling the `open` attribute directly when they aren't (jsdom,
  used in tests, doesn't implement `HTMLDialogElement.showModal`/`close`).
  Clicking the backdrop (`event.target === dialogRef.current`, the standard
  native-`<dialog>` trick) and native cancel (Escape) both call `onClose`.
  First consumer: KAN-31's create-campaign dialog; KAN-82's manage-campaign
  modal should reuse it rather than building its own.
- `Window` (KAN-80/KAN-88) — chrome for one desktop window: title bar
  (`title`, a close button calling `onClose`) + body (`children`) + a
  resize handle. Drag/resize and z-index-to-front are not implemented
  inside `Window` itself — it just exposes `onTitleBarPointerDown`/
  `onPointerDownCapture`/`onResizeHandlePointerDown` passthrough props
  so the consumer's own pointer-event logic (`apps/web`'s
  `useDesktopLayout` hook) can drive position/size/z-index externally.
  Pure presentational component, no internal state.
- `Dock` (KAN-80) — row of toggle buttons, one per `DockItem {id, title,
open}`, calling `onToggle(id)` on click; `open` renders a filled dot
  indicator. Used to reopen windows closed via `Window`'s × button.

Usage from `apps/web`:

```tsx
import {
  Button,
  Dock,
  Form,
  FormField,
  Input,
  Link,
  Modal,
  Window,
} from "@storyforge/ui";
```

Real consumers: `LoginPage.tsx`, `RegisterPage.tsx`, `DashboardPage.tsx`
(KAN-31 — `Button`/`Form`/`Input`/`Link`/`Modal`), and `DesktopBoard.tsx`
(KAN-80 — `Window`/`Dock`, see `apps/web` section below).

React is a `peerDependency` only (not a devDependency of this package)
— deliberately, to avoid a second physical React copy under
`packages/ui` causing "Invalid hook call" once Vite bundles this
package's source into `apps/web`.

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
- Eleven vertical-slice modules under `src/modules/` today: `auth`,
  `campaigns`, `campaignMembers`, `entities`, `tags`, `relationships`,
  `notes`, `noteLinks`, `sessions`, `events`, `attachments`. All follow the
  same `application/` (service, use cases) → `graphql/` (schema +
  resolvers) → `infrastructure/` (Prisma repository + mapper) layout; only
  the two most load-bearing are detailed below. See `docs/FEATURES.md` for
  current per-module status — that file is kept in sync with what's
  actually built, this section isn't re-derived from it automatically.
  - `src/modules/entities/`, split into `application/` (`EntityService.ts`
    — create/update/delete/get/list use cases), `graphql/` (schema +
    resolvers, fully implemented — `entities(campaignId, filter:
EntityFilter)` takes an optional `EntityFilter { type, nameContains,
tagIds }` input, passed unchanged through `EntityService.listEntities`
    down to `PrismaEntityRepository.findByCampaign`, which AND-combines an
    exact `type` match, case-insensitive `nameContains`, and an any-match
    `tagIds` filter via the `EntityTag` join — always excludes
    soft-deleted rows), and `infrastructure/` (`PrismaEntityRepository`,
    `EntityMapper`, `LocalImageStore`). Also owns image upload:
    `uploadEntityImage(entityId, file: Upload!)` mutation over the
    [GraphQL multipart request spec](https://github.com/jaydenseric/graphql-multipart-request-spec)
    (native `graphql-yoga` support, no extra deps).
    `LocalImageStore.save()` validates MIME type (JPEG/PNG/GIF/WEBP),
    filename length, and a 5MB size cap, then writes to
    `UPLOADS_DIR/<entityId>/<uuid>.<ext>` and returns that path as
    `Entity.image`. `UPLOADS_DIR` defaults to `<cwd>/uploads` if unset
    (`src/config/env.ts`). Reads (`entity`/`entities`) require
    `requireCampaignRole(..., "VIEW_ENTITY")` (any role); writes
    (`createEntity`/`updateEntity`/`deleteEntity`/`uploadEntityImage`)
    require `requireCampaignWriter` (EDIT_ENTITY — Owner/Storyteller/
    Co-Storyteller, KAN-62). Player and Observer reads are additionally
    filtered to `Visibility: PUBLIC` via the domain's
    `canViewVisibility`/`filterByVisibility` — `entities` drops non-public
    results, `entity(id)` throws `FORBIDDEN` for a non-public entity.
  - `src/modules/campaigns/`, same layout: `application/`
    (`CampaignService.ts` — create/update/archive/list; `archiveCampaign`
    additionally requires an `OWNER`-role `CampaignMember` to exist —
    `CampaignMapper.toDomain` now hydrates `campaignMembers` via an
    `include: { members: true }` query, so this check is reachable
    (KAN-79)), `graphql/` (`createCampaign` guarded via
    `requireCurrentUser` and persisting the caller as the OWNER member;
    `updateCampaign`/`archiveCampaign` guarded via
    `requireCampaignRole(..., "MANAGE_CAMPAIGN_SETTINGS")` (Owner only,
    KAN-62); `campaigns` query scoped to the caller's own `CampaignMember`
    rows via `requireCurrentUser` (KAN-78) and excluding archived
    campaigns; `campaign(id)` requires `requireCampaignMember`),
    `infrastructure/` (`PrismaCampaignRepository`, `CampaignMapper`).
  - `src/modules/auth/` (KAN-28), same layout: `application/`
    (`AuthenticationService.ts` — `register`/`login`, bcrypt hashing via
    `bcrypt-ts`, JWT issuance via `jsonwebtoken` with a minimal
    `{ sub: userId }` payload — full domain objects never go in the token;
    `register` validates the RAW password via `User.validatePlainPassword`
    before hashing — the domain entity only ever sees the hash, which
    would pass any length rule), `graphql/` (`login`/`registerUser`
    mutations returning `AuthPayload { token, user }` and also setting the
    HttpOnly auth cookie; `logout` clears it; `me` query resolves
    `context.currentUser` or `null`), `infrastructure/`
    (`PrismaUserRepository`, `UserMapper`). Session strategy is JWT
    (stateless, no session table) — decided explicitly over server-side
    sessions and refresh-token pairs; revisit only if
    revocation-before-expiry becomes a real requirement.
  - `src/modules/campaignMembers/` (KAN-77) owns `CampaignMember` as its
    own aggregate (not nested under `Campaign`) and the shared guard
    library other modules build on (`graphql/guards.ts`):
    `requireCampaignMember` (any role, throws `ForbiddenError` if no
    membership), `requireCampaignRole` (membership + permission-matrix
    check, KAN-62 — `MANAGE_MEMBERS` gates `addCampaignMember`/
    `removeCampaignMember`/`updateCampaignMemberRole`), and
    `requireCampaignWriter` (shorthand for
    `requireCampaignRole(..., "EDIT_ENTITY")`). `CampaignMemberService`
    enforces the single-owner invariant in both directions: adding or
    promoting a second OWNER is rejected, and removing or demoting the
    existing OWNER is rejected so a campaign can never be orphaned.
  - `src/modules/tags/` (KAN-37), same layout: `application/`
    (`TagService.ts` — `addTagToEntity`/`removeTagFromEntity` (find-or-create
    the campaign-scoped `Tag` by normalized name, then idempotently
    attach/detach the `EntityTag` link), `listCampaignTags`, `listEntityTags`;
    takes both `TagRepository` and `EntityRepository` since it needs to
    resolve `campaignId` from `entityId` and validate the entity exists),
    `graphql/` (`addTagToEntity`/`removeTagFromEntity` mutations guarded
    via `requireCampaignWriter` (tags mutate shared world data, same as
    entity writes), `campaignTags` query via `requireCampaignMember` — the
    mutations resolve the entity first via `entityService.getEntity` to
    derive its `campaignId`, since neither takes `campaignId` directly;
    plus `Entity.tags` field resolver added directly to
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
registration/wiring beyond manual instantiation. Auth/permission gating
(KAN-61/62) is a guard hierarchy in `modules/auth/graphql/guards.ts`
(`requireCurrentUser`) and `modules/campaignMembers/graphql/guards.ts`
(the rest), applied at the top of every campaign-scoped resolver across
every module:

- `requireCurrentUser` — authenticated, no campaign check (used directly
  by a few resolvers, e.g. `campaigns`/`me`, and as the base every other
  guard calls internally).
- `requireCampaignMember(context, campaignId)` — authenticated + any-role
  membership in the target campaign. Used for all reads, and for writes
  on the collaborative surfaces (notes, attachments) where Players are
  meant to write (`createNote` takes `authorId` from the membership).
- `requireCampaignRole(context, campaignId, action)` — membership +
  `hasPermission(role, action)` against the domain permission matrix
  (`packages/domain/src/permission`). `MANAGE_MEMBERS` gates the
  CampaignMember mutations; `MANAGE_CAMPAIGN_SETTINGS` gates
  `updateCampaign`/`archiveCampaign`; `VIEW_ENTITY` gates entity reads
  (combined with `canViewVisibility`/`filterByVisibility` so
  Player/Observer only see `PUBLIC` entities).
- `requireCampaignWriter(context, campaignId)` — shorthand for
  `requireCampaignRole(..., "EDIT_ENTITY")` (Owner/Storyteller/
  Co-Storyteller). Gates ALL world-data writes: entities (incl. image
  upload), tags, relationships, sessions, and events. Notes/attachments
  deliberately stay `requireCampaignMember` (see above).

Treat any resolver missing one of these guards as a bug, not an accepted
gap, when touching this code. Related invariants enforced at the service
layer: a campaign has exactly one OWNER (`CampaignMemberService` rejects
adding/promoting a second owner AND removing/demoting the existing one —
so the campaign can never be orphaned; ownership transfer is not
implemented yet and would need an atomic swap), and archived campaigns
are excluded from `listCampaigns` (still reachable via `campaign(id)`).

Remaining known gaps: `Entity.visibility`-based read filtering only
exists for entities, not notes/sessions/timeline; the `Campaign.members`
field resolver is unguarded by design for now (the web app reads it to
resolve the viewer's own role — needs a dedicated "my membership" query
before it can be restricted); `Campaign.name` is globally unique across
all users (single-tenant assumption baked into the schema — revisit
before multi-tenant use).

No business logic belongs here — resolvers call services, services call
repositories.

---

## apps/web

No longer the default Vite scaffold — routing, a GraphQL client, full
auth flow, and the campaign desktop shell are all wired:

- `react-router-dom` v7 (`src/router.tsx`/`src/routes/routeConfig.tsx`):
  `/login`, `/register` (both public), `/dashboard` and `/campaigns/:id`
  (both behind `ProtectedRoute`).
- `ProtectedRoute` (`src/routes/ProtectedRoute.tsx`) — runs the `me`
  GraphQL query via `urql`, redirects to `/login` if `data.me` is null.
- `urql` client (`src/lib/urqlClient.ts`), `Provider` wired in `main.tsx`.
- `LoginPage`/`RegisterPage` (`src/pages/`) — built on `@storyforge/ui`
  (KAN-75): `Form`/`FormField`/`Input`/`Button`/`Link`. Fully wired to the
  `login`/`registerUser` mutations; on success, `navigate("/dashboard")`.
- `DashboardPage` (`src/pages/DashboardPage.tsx`) — lists the caller's
  campaigns (`campaigns` query) with member count and the caller's role
  per card; "New campaign" opens `CreateCampaignDialog` (a `Modal` +
  `createCampaign` mutation, re-fetches the list on success); each card
  has an "Enter campaign" button (`navigate('/campaigns/${id}')`) and,
  for the `OWNER` role, a "Manage" button opening `ManageCampaignModal`
  (KAN-82 — name/description edit via `updateCampaign`, plus an
  archive flow gated behind an inline confirm step; both actions
  refetch the dashboard's campaign list on success).
- `CampaignDesktopPage` (`src/pages/CampaignDesktopPage.tsx`, KAN-80) —
  loads the campaign via the `campaign(id)`/`me` queries, resolves the
  caller's role from `campaign.members`, then renders `DesktopBoard`
  (viewport ≥768px) or `MobileDesktop` (<768px) via `useMediaQuery`:
  - `DesktopBoard` (`src/components/DesktopBoard.tsx`) — renders one
    `@storyforge/ui` `Window` per entry in `WINDOW_CATALOG`
    (`src/lib/windowCatalog.ts`), positioned/sized/z-ordered from
    `useDesktopLayout` (`src/hooks/useDesktopLayout.ts`). That hook owns
    drag and resize (pointer-event based, clamped to the board's bounds,
    KAN-88), bring-to-front on click/drag-start, close/reopen (`toggle`),
    and persists the full layout to `localStorage` under
    `storyforge:desktop:<campaignId>` on every drag/resize-end and toggle
    — so
    arrangement survives a page reload, scoped per campaign. A `Dock`
    lists every catalog entry and toggles visibility; a "Reset layout"
    button clears storage and restores `DEFAULT_LAYOUT`.
  - `MobileDesktop` (`src/components/MobileDesktop.tsx`) — the same
    `WINDOW_CATALOG`, rendered as a single active panel with a tab bar
    instead of draggable windows. No layout persistence (nothing to
    persist — just an `activeId` selection).
  - `WINDOW_CATALOG` (`src/lib/windowCatalog.ts`) is data-driven —
    `{id, title, render, visibleToRoles?}` entries — specifically so
    KAN-39/81/84/49/85 can each swap their entry's `render` for a real
    component without touching `DesktopBoard`/`MobileDesktop`. `npcs`
    (`NpcsWindow` — role-aware CRUD, Players/Observers get a read-only
    list) and `members` (`MembersWindow` — Owner gets add/remove/
    change-role with mutation errors surfaced in a `FormError` banner;
    hidden entirely from Players/Observers via `visibleToRoles`) are real
    now; `sessions`/`timeline`/`notes` still render `ComingSoonPanel`
    (`src/components/ComingSoonPanel.tsx`), a one-line placeholder naming
    the tracking ticket.
- `src/index.css` only holds `apps/web`-shell layout/typography rules;
  design tokens (colors, fonts, shadows) live in
  `@storyforge/ui/tokens.css`, imported once in `main.tsx`.

Target responsibilities not yet realized: UI extension rendering
(plugin-contributed UI), and the real content for the remaining Campaign
Desktop windows (Timeline, Sessions, Notes — KAN-49/84/85), which are
still `ComingSoonPanel` placeholders inside the KAN-80 shell. NPCs
(KAN-39) and Members (KAN-81) now render real content.

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
`pnpm test:unit` then `pnpm lint-staged` — the latter isn't a defined root
script, but `pnpm` resolves it straight from `node_modules/.bin`. `lint-staged`
config (root `package.json`) runs `eslint --fix` + `prettier --write` on
staged `*.{js,ts,tsx,jsx}` and `prettier --write` on staged `*.{json,md}`, so
a lint/format violation is blocked locally before it reaches CI. `test:unit`
excludes the Prisma repository integration tests (see Testing section) so
the hook never needs a live Postgres — CI still runs the full suite
(unit + integration) via `pnpm turbo run lint build test`.

---

# Testing

Vitest, wired per-package (`packages/domain`, `apps/api`; each has its own
`test` script, `turbo.json`'s `test` task runs them via `dependsOn: ["^build"]`
so workspace deps are built first). Current coverage (605 tests: 168
`packages/domain` + 437 `apps/api`).

Every package also exposes a `test:unit` script (turbo task `test:unit`)
that runs the same suite minus the Prisma repository integration tests —
that's what `.husky/pre-commit` runs, so committing never requires a live
Postgres. `apps/api` additionally exposes `test:integration`
(turbo task `test:integration`) to run just the Prisma repository tests.
The split is driven by filename: integration tests are named
`*.integration.test.ts` and picked up via dedicated Vitest configs
(`apps/api/vitest.unit.config.ts` excludes them, `vitest.integration.config.ts`
includes only them, both `mergeConfig`-extending the base `vitest.config.ts`).
The plain `test` script/task is untouched and still runs everything
(unit + integration) in one pass — that's what CI's
`pnpm turbo run lint build test` uses, unchanged.

- **Domain unit tests** (`packages/domain/src/**/*.test.ts`) — `Campaign`,
  `Entity`, `CampaignMember`, `User`, `Tag`, `Relationship`, `Note` (incl.
  `moveTo`/nesting), `NoteLink`, `Id`, `DomainError` subclasses. Pure logic,
  no mocks, no I/O.
- **Application service tests** (`apps/api/src/modules/*/application/*.test.ts`)
  — `CampaignService`, `EntityService`, `AuthenticationService`, `TagService`,
  `RelationshipService`, `NoteService` (incl. link syncing, nesting/moveNote,
  cycle- and depth-cap rejection, cascade soft-delete) against hand-rolled
  `vi.fn()` mocks of the repository interfaces (`TagService` mocks both
  `TagRepository` and `EntityRepository`). `AuthenticationService` uses real
  `bcrypt-ts`/`jsonwebtoken` (not mocked) so the token roundtrip is actually
  verified, not assumed. `NoteLinkParser`/`NoteLinkResolver`
  (`apps/api/src/modules/notes/application/`) get their own pure-logic test
  files despite living outside `packages/domain` — parsing is regex-only and
  resolution only needs repository mocks, no Prisma.
- **Mapper tests** (`apps/api/src/modules/*/infrastructure/*Mapper.test.ts`)
  — `toDomain`/`toPersistence` roundtrips against literal Prisma-shaped
  records.
- **GraphQL resolver tests** (`apps/api/src/modules/*/graphql/resolvers/*.test.ts`)
  — e.g. `entities/graphql/resolvers/{Query,Mutation}.test.ts` — against a
  hand-rolled `EntityService` mock, asserting argument pass-through
  (including `entities(campaignId, filter)`) and `toGraphQLError` mapping.
- **Prisma repository integration tests**
  (`apps/api/src/modules/*/infrastructure/Prisma*Repository.integration.test.ts`) — hit a
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

`apps/web` and `packages/ui` have Vitest + Testing Library test infra
(component/unit level, 99 tests total: 73 `apps/web` + 26 `packages/ui`)
— `apps/web/src/router.test.tsx`, page-level tests per page
(`LoginPage`/`RegisterPage`/`DashboardPage`/`CampaignDesktopPage.test.tsx`),
component-level tests for the KAN-80 shell (`DesktopBoard.test.tsx`,
`MobileDesktop.test.tsx`), and per-component `*.test.tsx` files under
`packages/ui/src/components/` (including `Window`/`Dock`) — run via the
same root `pnpm turbo run lint build test` as everything else. No
frontend end-to-end (real browser, real backend) test infra exists yet
— see KAN-87 (frontend e2e tests). No test infra for the compiler
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

The core application currently implements (see `docs/FEATURES.md` for the
full per-feature checklist):

- **Authentication** — `User` aggregate + `AuthenticationService`
  (register/login, bcrypt hashing, JWT issuance), wired end-to-end through
  `login`/`registerUser`/`logout` GraphQL mutations (KAN-28; the token is
  also set/cleared as an HttpOnly cookie), plus a `me` query
  (`context.currentUser`, resolves to `null` when logged out). Every
  campaign-scoped resolver across every module is gated by one of the
  guards described in the apps/api notes above (`requireCurrentUser` →
  `requireCampaignMember`/`requireCampaignRole`/`requireCampaignWriter`),
  backed by the KAN-61/62 five-role permission matrix in
  `packages/domain/src/permission`.
- **Campaign** — the top-level container. Everything belongs to a
  Campaign. Domain entity + `CampaignService` (create/update/archive,
  KAN-29) now implemented, same domain → service → Prisma repository
  shape as Entity. GraphQL resolvers (`campaign`, `campaigns`,
  `createCampaign`, `updateCampaign`, `archiveCampaign`) wired.
  `campaigns` is scoped to the caller's own `CampaignMember` rows
  (KAN-78). `CampaignMapper.toDomain` hydrates `campaignMembers` from an
  `include: { members: true }` query (KAN-79), so `archiveCampaign`'s
  no-owner check now resolves correctly.
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
- **Relationships** (KAN-40/41), **Notes** incl. nesting, wiki-style
  links, and attachments (KAN-43/44/45/46), **Sessions** (KAN-47), and
  **Events** incl. participants (KAN-48) — all follow the same
  domain → service → Prisma repository → GraphQL shape; per-module detail
  in the apps/api notes above and `docs/FEATURES.md`.

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
