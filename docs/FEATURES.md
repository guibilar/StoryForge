# StoryForge — Feature Checklist

Status snapshot generated from repo inspection. Update as work lands — this file
tracks what's actually built, not just planned.

## Foundation

- [x] pnpm workspace + Turborepo
- [x] TypeScript, ESLint, Prettier
- [x] React + Vite frontend scaffold, routing (`react-router-dom`),
      GraphQL client (`urql`), `ProtectedRoute`
- [x] `packages/ui` (KAN-75, KAN-80) — shared component package: `Button`,
      `Checkbox`, `CommandPalette`, `Form`/`FormField`/`FormActions`/`Label`/
      `FormError`, `Icon` (wraps `lucide-react`), `Input`, `Link`, `Modal`,
      `Select`, `Tabs`, `Textarea`, `Window` (incl. a loading overlay,
      refresh button, and Tab-cycling focus trap); CSS Modules on a
      theme-ready token system (`[data-theme]` palettes). Thin scope —
      exactly what each landed ticket needed, not a full design system yet
      (no tables). No build step (source consumed directly by Vite).
      Consumers: every page and campaign-desktop component in `apps/web`.
- [x] Fastify / graphql-yoga backend boots
- [x] GraphQL setup (schema merge, context, error mapping; date args
      validated via `parseRequiredDate`/`parseOptionalDate` — `null`/garbage
      strings are `BAD_USER_INPUT`, never a silent 1970 epoch or a masked
      internal error)
- [x] Cookie-based auth transport — `login`/`registerUser` set an HttpOnly
      `token` cookie (SameSite=Lax, Secure in production, 8h Max-Age matching
      the JWT), `logout` mutation clears it; `Authorization: Bearer` still
      wins when both are present. Static `/uploads/*` handler serves entity
      images/attachments (path-traversal-safe, tolerates malformed
      percent-encoding and query strings)
- [x] Docker — root `docker-compose.yml` (Postgres, one-off migrate service,
      API, web-behind-nginx) + `apps/api/Dockerfile`/`apps/web/Dockerfile`;
      see README "Docker"
- [x] Storybook for `packages/ui` (`pnpm --filter @storyforge/ui storybook`,
      per-component `*.stories.tsx`; not in CI)
- [x] CI pipeline (`.github/workflows/ci.yml` — lint, build, test on push/PR
      to main; runs a `postgres:16` service container + `prisma migrate deploy`
      so Prisma repository integration tests run for real, not mocked)
- [x] Husky hooks — pre-commit runs `pnpm test:unit` then `pnpm lint-staged`
      (KAN-24; no Postgres needed to commit)
- [x] Test suite — 1381 tests via Vitest: 302 `packages/domain` (entities,
      value objects, permission matrix, tags, relationships, notes, note
      links, sessions, events, markers/territories/map image, workspace
      state) + 573 `apps/api` (application services w/ mocked repos, Prisma
      mappers, GraphQL resolvers, and Prisma repository integration tests
      against a real Postgres) + 426 `apps/web` + 80 `packages/ui`
      (component/page-level). See AGENTS.md "Testing" section for layout
      and gotchas.

## Authentication & Campaigns

- [x] `User` domain entity + Prisma model
- [x] `Campaign` domain entity + Prisma model
- [x] `CampaignMember` model (KAN-27) — value object on `Campaign`, join table w/ role enum
- [x] AuthenticationService (register/login, bcrypt hashing, JWT) (KAN-28)
      — `register` validates the raw password (`User.validatePlainPassword`)
      before hashing; previously the rules ran against the bcrypt hash, so
      empty/short passwords were accepted
- [x] CampaignService (create/update/archive) (KAN-29) — `archiveCampaign`'s
      owner-check now resolves correctly: `CampaignMapper.toDomain` hydrates
      `campaignMembers` via an `include: { members: true }` query (KAN-79).
      Archived campaigns are excluded from the `campaigns` list (the archive
      confirm dialog promises they disappear from the dashboard) but stay
      reachable via `campaign(id)`. Campaign names are globally unique
      across all users — a known single-tenant assumption, revisit before
      multi-tenant use
- [x] GraphQL: `login`, `registerUser`, `logout` (mutations also set/clear
      the HttpOnly auth cookie)
- [x] GraphQL: `campaigns`, `campaign(id)`, `createCampaign`, `updateCampaign`, `archiveCampaign`
      — all five are guarded (KAN-83); `updateCampaign`/`archiveCampaign`
      require `MANAGE_CAMPAIGN_SETTINGS` (Owner only, KAN-62); `campaigns` is
      scoped to the caller's own `CampaignMember` rows (KAN-78) and excludes
      archived campaigns. `createCampaign` persists the requesting user as an
      `OWNER` `CampaignMember` row, so newly created campaigns always have an
      owner.
- [x] GraphQL: `me` (returns `context.currentUser`, no guard — resolves to `null` when
      logged out rather than throwing)
- [x] CampaignMember GraphQL surface (KAN-77) — `CampaignMemberService`,
      `PrismaCampaignMemberRepository`, `CampaignMemberMapper` under
      `apps/api/src/modules/campaignMembers/`; `CampaignMember` now carries its
      own `campaignId` (previously only `userId`/`role`) so it has an
      independent repository, mirroring how `Relationship`/`Tag` are
      persisted outside the `Campaign` aggregate rather than through
      `Campaign.addMember`/`removeMember` (`CampaignMapper.toDomain` now
      hydrates `members` for reads — KAN-79 — but `toPersistence` still
      only serializes `id`/`name`/`description`, so writes still go
      through the dedicated `CampaignMember` repository, not
      `CampaignRepository.update`). `Campaign.members`
      field resolver lists a campaign's members; `addCampaignMember`,
      `removeCampaignMember`, `updateCampaignMemberRole` mutations, all
      gated by `requireCampaignRole(..., "MANAGE_MEMBERS")` (Owner only,
      KAN-62) mapped to a `ForbiddenError`/`FORBIDDEN` GraphQL error code.
      Single-owner invariant enforced in both directions: adding/promoting
      a second OWNER is rejected, and removing/demoting the existing OWNER
      is rejected (a campaign can never be orphaned; ownership transfer is
      a future feature needing an atomic swap).
- [x] Frontend: protected routes (`ProtectedRoute` via `me` query), login +
      register pages wired to their mutations, dashboard (campaign list,
      create-campaign dialog, "Enter campaign" navigation to
      `/campaigns/:id`), all built on `packages/ui`
- [x] Frontend: Campaign Desktop shell (KAN-80) — draggable/resizable
      (KAN-88)/closable/reopenable windows on a per-campaign board
      (`DesktopBoard`), layout (position/size/open-state) persisted to
      `localStorage` per campaign, single-panel tab-switcher fallback below
      the mobile breakpoint (`MobileDesktop`). Window content is data-driven
      (`WINDOW_CATALOG`, incl. per-role visibility via `visibleToRoles`) so
      each window can plug in without touching the shell — all six catalog
      entries (Members, Sessions, Timeline, Notes, Relationship Graph, Maps)
      are real, role-aware content; no placeholder windows remain. The
      earlier dock (row of toggle buttons to reopen closed windows) was
      removed — `EntitySidebar`'s World nav does that job for every window.
      `Window` itself (KAN-106/110/111) additionally supports a blocking
      loading overlay + refresh button in its title bar and a Tab-cycling
      focus trap with Esc-to-close and focus restore on close.
- [x] Dynamic per-id windows (KAN-95) — `useDesktopWindows().openWindow`/
      `closeWindow` support windows outside the static `WINDOW_CATALOG`,
      keyed by id (e.g. `entity:<id>` for an entity detail window,
      `marker-form:<id>` for a marker edit form) — the mechanism every
      entity/note/session/event/marker/territory/relationship create-or-edit
      window and detail window uses.
- [x] Entity sidebar navigation (KAN-96) — `EntitySidebar` lists a
      campaign's entities grouped and collapsible by `type`, plus the World
      nav (Timeline/Sessions/Notes/Members/Relationship Graph/Maps) as
      toggle links sharing state with `DesktopBoard` via
      `DesktopWindowsContext`.
- [x] Entity detail window (KAN-96/97) — `EntityWindow`, opened from the
      sidebar, the relationship graph, the command palette, or a
      Storyteller's force-open broadcast, all via the shared
      `useOpenEntityWindow` hook. Three tabs: Overview (name/type/
      description/visibility, portrait upload, and — for
      `LOCATION`/`ORGANIZATION` entities — the map-color override, see
      World Building below), Relationships (this entity's `Relationship`
      rows; clicking a counterpart opens its window, KAN-98), and Notes
      (still a "coming soon" stub — no per-entity notes view exists yet).
- [x] Global command palette (KAN-99/100) — `AppCommandPalette`
      (⌘K/Ctrl+K), client-side fuzzy-scored (`src/lib/commandScore.ts`)
      search across entities/notes/sessions plus quick-create actions, no
      dedicated search backend. Recently-opened entities
      (`useRecentEntities`, `localStorage`-backed, capped at 10) surface as
      their own section.
- [x] Named layout presets (KAN-101) — save/apply a named snapshot of the
      desktop board's current window layout, stored alongside the layout
      itself.
- [x] Server-persisted per-user workspace state (KAN-103/104) — a
      campaign's desktop layout + recently-opened-entities list, debounce-
      synced to the server per `(campaignId, userId)` on top of the existing
      `localStorage` persistence (which still works standalone if the
      server round-trip fails or hasn't landed).
- [x] Shared add/edit form-window pattern (KAN-107/108/109) — every
      create/edit flow (entities, notes, sessions, events, markers,
      territories, relationships) opens as a desktop `Window` via
      `useAddEditWindow` rather than a `Modal`; the earlier quick-create
      modals and the Sessions/Timeline `Modal`-based forms were migrated
      onto this shared pattern.
- [x] Frontend: Members window (KAN-81) — `MembersWindow` in the Campaign
      Desktop's `members` catalog slot (hidden from Players/Observers via
      `visibleToRoles`): lists members with role; Owner additionally gets
      add-by-email (role select), per-row role change, and remove. Mutation
      failures (e.g. trying to demote/remove the owner) surface in a
      `FormError` banner instead of being silently swallowed.
- [x] Frontend: Sessions and Timeline windows (KAN-47/48/49/84/109) —
      `SessionsWindow`/`TimelineWindow`, full create/edit/delete for
      `Session`/`Event` (writer-gated), with Timeline additionally offering
      chronological ordering, free-text search, and a participant filter.
- [x] Frontend: Notes window (KAN-43/63/85/89/90) — `NotesWindow`, full
      create/edit/delete for `Note`, visible to every role (the API's
      visibility filter, not window-level hiding, decides what each role
      can read); Players can author and manage their own notes.
- [x] Manage-campaign modal (KAN-82) — "Manage" button on owner-owned
      dashboard cards opens `ManageCampaignModal` (name field, description
      textarea, wired to `updateCampaign`); Archive is a destructive text
      action separate from Cancel/Save, gated behind an inline confirm step
      (no undo — `archiveCampaign` has no unarchive mutation). Both actions
      close the modal and refetch the dashboard's campaign list.

## World Building

- [x] Entity CRUD backend (SF-001): service, repository, GraphQL resolvers
      — `entity(id)`, `entities`, `createEntity`, `updateEntity`, `deleteEntity`
      (KAN-83). Reads (`entity`/`entities`) require `VIEW_ENTITY` (any role);
      writes (`createEntity`/`updateEntity`/`deleteEntity`/
      `uploadEntityImage`) require `requireCampaignWriter` (`EDIT_ENTITY` —
      Owner/Storyteller/Co-Storyteller, KAN-62). `entities`/`createEntity`
      check membership on the given `campaignId` directly; the rest load the
      entity first to get its `campaignId` since only `id` is given. Player
      and Observer reads are filtered to `Visibility: PUBLIC` via the domain
      `canViewVisibility`/`filterByVisibility` helpers (`entities` drops
      non-public results; `entity(id)` throws `FORBIDDEN` for a non-public
      entity).
- [x] Entity soft delete
- [x] Duplicate-name validation per campaign
- [x] Generic `type` field (free subtype label, no type-specific schema)
- [x] `EntityCategory` closed core enum (KAN-118) — `CHARACTER`/`LOCATION`/
      `ORGANIZATION`/`ITEM`/`OTHER`, required alongside `type`; enforced via
      `Entity.validateCategory`, filterable via `EntityFilter.category`.
      Existing rows backfilled by migration
      `20260719024607_add_entity_category` (best-effort match against the
      pre-existing free-string `type`, falling back to `OTHER`).
- [x] Player Character / NPC split (KAN-119) — `isPlayerCharacter: boolean`
      on `Entity` (default `false`), settable only when `category ===
CHARACTER` (enforced in both directions: `changeCategory` and
      `changeIsPlayerCharacter` cross-validate). `EntityFormWindow` shows
      the toggle only when `CHARACTER` is selected.
- [x] Player Character owner link (KAN-120) — `Entity.ownerUserId` (nullable,
      `onDelete: SetNull`), settable only on an `isPlayerCharacter` entity;
      `Entity.linkOwner`/`changeIsPlayerCharacter` cross-validate the same
      way `category`/`isPlayerCharacter` do (turning `isPlayerCharacter`
      off auto-clears the owner rather than blocking the change).
      References a `User`, not a synthetic `CampaignMember` id — a
      `CampaignMember` is identified by `(campaignId, userId)` everywhere
      in this codebase (see `CampaignMemberMapper`'s `id` synthesis).
      `EntityService` validates the owner is an actual member of the
      entity's campaign via `CampaignMemberRepository.findByCampaignAndUser`.
      GraphQL: `Entity.ownerUserId`/`Entity.ownerMember` (resolved via
      `campaignMemberService.getMembership`), `ownerUserId` on
      `CreateEntityInput`/`UpdateEntityInput`. Data model only — does not
      grant the linked player write access to their own PC (a future
      permission ticket).
- [x] Portrait / image upload — `uploadEntityImage` mutation (GraphQL multipart
      request spec), `LocalImageStore` (validates JPEG/PNG/GIF/WEBP, 5MB limit,
      writes to `UPLOADS_DIR/<entityId>/<uuid>.<ext>`), guarded via
      `requireCampaignWriter` (loads the entity first, same as above); frontend
      upload control and rendering live in `EntityWindow`'s Overview tab
      (KAN-124, KAN-125)
- [x] Entity map colour override — nullable `Entity.color` (6-digit hex,
      validated by `Entity.changeColor`), settable via `createEntity`/
      `updateEntity`. `EntityFormWindow` shows a colour picker at create time
      and `EntityWindow`'s Overview tab a "Set/Change Map Color"/"Reset"
      control at edit time, both gated to `LOCATION`/`ORGANIZATION` categories
      (the only ones Markers/Territories can link to, KAN-121/122). `MapCanvas`
      prefers `entity.color` over its existing type-derived hash colour
      (`resolveFeatureColor`), so a specific location/faction can be made to
      stand out on the map; unset falls back to the pre-existing hash.
      Fixed alongside it: `markers.graphql`/`territories.graphql` previously
      under-selected their linked `entity` (missing `category`/`image`/
      `color`), so opening an entity from a map marker/territory popup always
      showed the placeholder portrait even when the entity had one — widened
      both queries and `MapCanvas`'s `MapLinkedEntity` type to carry the same
      fields `EntityWindow` needs.
- [x] Tags (KAN-37) — campaign-scoped `Tag`/`EntityTag` join model (reusable
      across entities in a campaign, name normalized trim+lowercase);
      `addTagToEntity`/`removeTagFromEntity` GraphQL mutations (find-or-create
      by name, idempotent attach/detach), `campaignTags` query, `Entity.tags`
      field. Both mutations require `requireCampaignWriter` (tags mutate
      shared world data, same rule as entity writes, KAN-62); `campaignTags`
      requires `requireCampaignMember` (any role). The mutations resolve the
      entity first (`entityService.getEntity`) to derive its `campaignId`
      before checking the role, since neither mutation takes `campaignId`
      directly.
- [x] Search / filtering — `entities(campaignId, filter: EntityFilter)`
      GraphQL query; `EntityFilter { type, nameContains, tagIds }`, AND-combined
      (`type` exact match, `nameContains` case-insensitive, `tagIds` any-match
      via `EntityTag` join), all fields optional
- [x] Frontend: dedicated NPCs window (KAN-39, `NpcsWindow`/`npcs` catalog
      slot) removed — NPCs are entities like any other, reached through
      `EntitySidebar`'s Entities list. The generic entity path covers
      create + view, plus two narrow post-creation edits (portrait upload,
      KAN-124/125; map-color override, see below) via dedicated
      single-purpose mutations. There is still no general edit form for an
      entity's name/type/description/category — `EntityFormWindow` is
      create-only, and delete has no generic replacement for the old
      NPC-specific flow yet.

## Relationships

- [x] Relationship domain model (KAN-40) — `Relationship` domain entity +
      `RelationshipRepository` interface (`packages/domain/src/relationship/`),
      `Relationship` Prisma model (directed edge, `sourceEntityId`/`targetEntityId`
      FKs to `Entity`, `onDelete: Cascade`); soft delete like `Entity`; blocks
      self-relationships and duplicate `(campaignId, source, target, type)` edges
      via a unique constraint.
- [x] Relationship types (MemberOf, Owns, Enemy, Ally, Parent, Child) (KAN-41)
      — `RelationshipService`, `PrismaRelationshipRepository`,
      `RelationshipMapper` under `apps/api/src/modules/relationships/`; GraphQL
      `relationship(id)`, `relationships(campaignId, entityId)` queries,
      `createRelationship`/`updateRelationship`/`deleteRelationship` mutations
      (queries guarded via `requireCampaignMember`; the three mutations
      require `requireCampaignWriter`, KAN-62 — `relationship`/
      `updateRelationship`/`deleteRelationship` load the relationship first
      to get its `campaignId` since only `id` is given). Directional-only for v1 —
      Ally/Enemy do not auto-create an inverse edge (deferred, not needed yet).
      No nested `sourceEntity`/`targetEntity` field resolvers — GraphQL type
      exposes raw IDs only. `type` is a validated free string (like
      `Entity.type`), not a closed enum — KAN-41 originally made it a TS/Prisma
      enum, reverted so future plugins (e.g. the VTM plugin's Sire/Childe/Ghoul
      relationship types) can define their own values without a core migration.
- [x] Graph visualization (React Flow) (KAN-42) — `RelationshipGraphWindow` in
      the Campaign Desktop's `relationships` catalog slot, built on
      `@xyflow/react` (the current maintained package — `reactflow` was
      renamed upstream). Fetches `entities(campaignId)` and
      `relationships(campaignId)`, maps them to nodes/edges with a
      deterministic circular layout (no dagre dependency), colors nodes by
      `Entity.type` and edges by `Relationship.type` from a fixed validated
      8-hue categorical palette (assigned in first-seen order since both
      `type` fields are open-ended free strings, not enums) — the type name
      is always shown as a text label too so color is never the only cue.
      Pan/zoom via React Flow defaults; clicking a node opens that entity's
      window. Visible to every campaign role (no `visibleToRoles`
      restriction).
- [x] Relationship create/edit/delete UI (KAN-123) — `RelationshipFormWindow`
      (`useAddEditWindow`, same shape as `MarkerFormWindow`/
      `TerritoryFormWindow`), opened from `RelationshipGraphWindow`'s
      "Add Relationship" button (writers only — Owner/Storyteller/
      Co-Storyteller, checked client-side the same way `MapsWindow` derives
      `isWriter`) or by clicking an edge to edit/delete it. Source/target
      entity pickers (`EntitySelectField`, extended with `required` and
      `onChange` props for this) are unrestricted by category — a
      Relationship connects any two entities, unlike Marker/Territory
      (KAN-121/122) — and only settable at creation, since
      `UpdateRelationshipInput` has no `sourceEntityId`/`targetEntityId`
      (KAN-41 — repoint by delete + recreate, not in-place edit). The type
      input suggests category-pair-appropriate values (e.g.
      CHARACTER+ORGANIZATION → "MemberOf") via a `<datalist>`
      (`src/lib/relationshipTypeSuggestions.ts`, pure/unit-tested) but the
      field stays free text end to end — `Relationship.type` is unchanged
      from KAN-41's decision to keep it an unvalidated string so future
      plugins can define their own values with no core migration.

## Notes & Assets

- [x] Rich text / markdown notes (KAN-43) — `Note` domain entity + `Note`
      Prisma model (`campaignId`/`authorId` FKs, `Cascade`, `content` stored
      as `Text`, soft delete like `Entity`); `NoteService`,
      `PrismaNoteRepository`, `NoteMapper` under `apps/api/src/modules/notes/`;
      GraphQL `note(id)`, `notes(campaignId)`, `createNote`, `updateNote`,
      `deleteNote`, all guarded via `requireCampaignMember`
      (`campaignMembers/graphql/guards.ts`, any role). Unlike world data
      (entities/tags/relationships/sessions/events, which writer-gate their
      mutations per KAN-62), note writes deliberately stay member-level —
      notes are the collaborative surface where Players journal
      (`createNote` takes `authorId` from the resolved membership); this
      held even after shared/private/targeted note visibility landed
      (KAN-63/89/90, see Collaboration) — visibility gates _reads_, not who
      may write a note.
      `createNote`/`notes` check membership on the input `campaignId`;
      `note`/`updateNote`/`deleteNote` first load the note to get its
      `campaignId`, then check membership on that. `createNote` takes
      `authorId` from the resolved membership, not client input. Markdown
      stored as raw source only (client renders) — no stored-HTML sanitization
      surface.
- [x] Attachments, images (KAN-44) — `Attachment` domain entity + `Attachment`
      Prisma model (`noteId` FK, `Cascade`, no soft delete — hard delete like
      `CampaignMember`/`Tag`); `AttachmentService`, `PrismaAttachmentRepository`,
      `AttachmentMapper` under `apps/api/src/modules/attachments/`. Files are
      stored on local disk via the existing `LocalImageStore`
      (`apps/api/src/modules/entities/infrastructure/LocalImageStore.ts`,
      already used for `Entity.image`) rather than a new object-storage
      client — no S3/MinIO configured anywhere in the repo, so this reuses
      the mechanism already wired to `UPLOADS_DIR` and the `/uploads/*`
      static handler. GraphQL `uploadNoteAttachment(noteId, file: Upload!)`,
      `deleteAttachment(id)`, and a `Note.attachments` field resolver, all
      guarded via `requireCampaignMember` (load the parent `Note` first to
      get its `campaignId`, same pattern as `updateNote`/`deleteNote`).
      Images only for v1, enforced by a mime-type allowlist (jpeg/png/gif/webp)
      in both `LocalImageStore` and the `Attachment` domain entity.
- [x] Internal links between notes/entities (KAN-45) — wiki-style syntax,
      decided over markdown-native links since it needs no renderer decision
      up front: `[[Label]]` resolves by exact-name match against an `Entity`
      in the same campaign, falling back to a `Note` title match if exactly
      one note has that title (no match, or an ambiguous title shared by 2+
      notes, silently drops the link rather than guessing);
      `[[Label|entity:<id>]]` / `[[Label|note:<id>]]` disambiguate explicitly,
      scoped to the same campaign. `NoteLink` join-table Prisma model
      (`noteId`, `targetEntityId?`, `targetNoteId?`) populated by
      `NoteLinkParser`/`NoteLinkResolver` (`apps/api/src/modules/notes/application/`)
      and persisted transactionally by `NoteService` on every
      `createNote`/`updateNote` (stale links removed on edit, not just
      appended). GraphQL: `Note.linkedEntities`, `Note.linkedNotes`,
      `Note.backlinks`, `Entity.backlinks`, all resolved via
      `apps/api/src/modules/noteLinks/` (Prisma repo/mapper + resolvers
      extending the `Note`/`Entity` types, mirroring how `attachments` extends
      `Note` from outside the `notes` module). `NoteFormWindow` edits/renders
      note content as markdown (`@uiw/react-md-editor`), but `[[Label]]`
      wiki-link syntax inside that markdown is not specially parsed into
      clickable links client-side yet — `Note.linkedEntities`/`linkedNotes`/
      `backlinks`/`Entity.backlinks` are resolved server-side and queryable,
      just not consumed by the frontend yet.
- [x] Nested notes (KAN-46) — self-referential `Note.parentNoteId`
      (`schema.prisma`, `onDelete: Cascade`); domain `Note.ParentNoteId` +
      `moveTo(parentId)` (rejects a note becoming its own direct parent — the
      only check pure domain logic can make without a repository).
      `NoteService.resolveParent` walks the ancestor chain to reject: a
      missing parent, a parent in a different campaign, cycles (moving a
      note under its own descendant), and nesting past a 5-level depth cap
      (all three: product decisions, not guessed). `createNote` accepts an
      optional `parentNoteId`; new `moveNote(id, parentNoteId)` mutation
      moves an existing note (`parentNoteId: null` detaches to root).
      GraphQL: `Note.parent`, `Note.children`, `Note.parentNoteId`,
      `noteRoots(campaignId)` query. Note: `deleteNote` is a soft delete
      (`deletedAt`, never a real `DELETE FROM`), so the Postgres
      `ON DELETE CASCADE` on `parentNoteId` never fires on its own —
      `NoteService.deleteWithDescendants` cascades the soft-delete down the
      subtree explicitly at the application layer instead.

## Sessions & Timeline

- [x] Session model (number, date, summary) (KAN-47) — `Session` domain
      entity + Prisma model (`campaignId` FK, `Cascade`; `sessionNumber`
      server-assigned, auto-incremented per campaign via
      `findMaxSessionNumber`, never client-supplied; `date`, `summary`
      nullable `Text`); `SessionService`, `PrismaSessionRepository`,
      `SessionMapper` under `apps/api/src/modules/sessions/`. GraphQL
      `session(id)`, `sessions(campaignId)` guarded via
      `requireCampaignMember`; `createSession`, `updateSession`,
      `deleteSession` require `requireCampaignWriter` (KAN-62 — Players/
      Observers are read-only for session records). `date` input is
      validated (`null`/unparseable → `BAD_USER_INPUT`). Hard delete (no
      `deletedAt`) — no restore requirement, no dangling references
      possible for a leaf model.
- [x] Event model (timeline, participants, related entities) (KAN-48) —
      `Event` domain entity + Prisma model (`campaignId` FK `Cascade`;
      `sessionId` **nullable** FK to `Session`, `onDelete: SetNull` — an
      Event can exist with no Session, e.g. backstory/pre-campaign events,
      and deleting a Session unlinks rather than destroys its Events;
      `title`, `description`, `occurredAt` — the in-fiction date, distinct
      from `Session.date`). Participants are many-to-many via an
      `EventParticipant` join table (`eventId`, `entityId`, optional
      `role`), mirroring the `Entity`↔`Tag` join pattern: persistence-only
      (no domain aggregate for the join row), idempotent attach/detach.
      `EventService` (`apps/api/src/modules/events/`) takes `EventRepository`,
      `EntityRepository`, and `SessionRepository` — validates a provided
      `sessionId` exists and belongs to the same campaign, and an
      `entityId` exists before attaching it as a participant. GraphQL
      `event(id)`, `events(campaignId)`, `eventsBySession(sessionId)`
      guarded via `requireCampaignMember`; `createEvent`, `updateEvent`,
      `deleteEvent`, `attachParticipant`, `detachParticipant` require
      `requireCampaignWriter` (KAN-62). `occurredAt` input is validated
      (`null`/unparseable → `BAD_USER_INPUT`). `Event.session` and
      `Event.participants` are field resolvers (mirroring `Note.parent`'s
      lazy service-call pattern), not Prisma includes. Hard delete, same
      rationale as Session.
- [x] Timeline UI (ordering, filters, search) — `TimelineWindow` sorts
      events chronologically by `occurredAt`, plus free-text search and a
      participant filter, both client-side over the already-fetched list.

## Maps

- [x] Leaflet integration (KAN-50) — `MapCanvas` (`react-leaflet`), pan/zoom,
      a dark/light tile layer following the app's theme.
- [x] Markers, territories, regions, districts (KAN-51) — `Marker`/
      `Territory` domain aggregates + Prisma models, GraphQL CRUD, a
      draw-mode toolbar (KAN-113/114/115) to place a marker or draw a
      territory polygon directly on the map, each linked to a world-data
      `Entity` (see the entity-link restriction bullets below).
- [x] Custom overlays / images as maps (KAN-52) — per-campaign map image
      upload, rendered via Leaflet's `CRS.Simple` (plain pixel space)
      instead of the geographic tile layer when set.
- [x] Marker entity links restricted to LOCATION-category entities
      (KAN-121) — `MarkerService.requireEntityInCampaign` rejects a
      non-`LOCATION` `entityId` with `ValidationError`; `EntitySelectField`
      (`categories` prop) filters the picker client-side to match, so
      `MarkerFormWindow` only ever offers `LOCATION` entities.
- [x] Territory entity links restricted to ORGANIZATION/LOCATION-category
      entities (KAN-122) — same shape as KAN-121, but a two-value allowlist:
      `Territory.type` already free-strings "territory"/"region"/"district"
      (see `Territory.ts`), and a district is more location-like than
      org-like, so `LOCATION` is included alongside `ORGANIZATION` rather
      than restricting to factions/orgs alone. `TerritoryFormWindow` passes
      both categories to `EntitySelectField`.
- [x] Marker/territory colour from the linked entity — `MapCanvas` colours
      pins and territory outlines by the linked entity's own `color` when
      set, falling back to its existing hash-of-`type` colour when not (see
      the entity map colour override bullet under World Building).
- [x] Storyteller live-viewport force-sync (KAN-129/130/131) — a
      Storyteller's `MapsWindow` can push its current center/zoom to one
      player, several, or everyone via a real-time subscription
      (`forceSyncViewport`); the target's map snaps to it once as a
      one-shot jump, not a continuous lock. See Collaboration below for the
      shared real-time transport this is built on.

## Plugin Runtime

- [ ] `packages/plugin-sdk` (currently empty)
- [ ] Plugin loader + registry
- [ ] Compile-time plugin compiler (`packages/compiler`, not started)

## Vampire: The Masquerade Plugin

- [ ] `packages/vtm-plugin` (currently empty)
- [ ] Character sheet (Clan, Generation, Blood Potency, Humanity, Hunger, Willpower, Health)
- [ ] Disciplines, Merits, Flaws
- [ ] Dice engine
- [ ] VTM relationship types (Sire, Childe, Ghoul, Prince, Primogen, Regent)
- [ ] VTM events (Embrace, Blood Hunt, Diablerie, Final Death)

## Collaboration

- [x] Roles (Owner, Storyteller, Co-Storyteller, Player, Observer) —
      KAN-61 widened `CampaignRole` to the 5-role set end to end (domain
      union type, Prisma enum + migration, GraphQL enum, frontend role
      selects).
- [x] Permissions (KAN-62/128) — domain permission matrix
      (`packages/domain/src/permission`): role → action map
      (`VIEW_ENTITY`, `EDIT_ENTITY`, `CREATE_NOTE`, `MANAGE_MEMBERS`,
      `MANAGE_CAMPAIGN_SETTINGS`, `BROADCAST_TO_PLAYERS`) consumed by the
      API guards (`requireCampaignRole`/`requireCampaignWriter`);
      Player/Observer are read-only for world data (entities, tags,
      relationships, sessions, events) and see only `PUBLIC`-visibility
      entities. Known gaps: visibility filtering exists for entities only
      (not sessions/timeline — notes have their own visibility system, see
      below); `Campaign.members` is readable by any member (the web app
      needs it to resolve the viewer's own role — wants a dedicated "my
      membership" query first).
- [x] Shared vs private notes, player handouts (KAN-63/89/90) — `Note`
      carries `SHARED` (everyone), `PRIVATE` (author only), or `TARGETED`
      (an explicit recipient list) visibility, enforced server-side on
      every read; Players can author and manage their own notes.
- [x] Real-time transport: GraphQL subscriptions over SSE (KAN-127) — an
      in-process pub/sub (`apps/api/src/graphql/pubsub.ts`) exposed via
      `graphql-yoga`'s native SSE support, no WebSocket server. Two
      Storyteller-only push features are built on it, both gated by
      `BROADCAST_TO_PLAYERS` and targeting "all players" or an explicit
      member list: force-syncing a player's map viewport to the
      Storyteller's (KAN-129/130/131, see Maps above), and force-opening a
      specific entity's window on a targeted player's screen
      (KAN-132/133) — the latter is a deliberate, documented bypass of the
      normal `PUBLIC`-visibility read filter, since the Storyteller is
      explicitly choosing to show that entity.

## Automation

- [ ] Automatic reminders
- [ ] Relationship validation
- [ ] Timeline consistency checks
- [ ] Unused NPC / broken reference detection

## AI Assistant

- [ ] Semantic search
- [ ] Session summaries
- [ ] NPC dialogue generation
- [ ] Plot suggestions / chronicle Q&A

## Cross-cutting gaps (not tied to a single area)

- [x] Frontend unit/component tests — `apps/web` (426 tests: Vitest +
      Testing Library, `router.test.tsx`, page tests, every real window/
      form component) and `packages/ui` (80 tests: per-component, incl.
      `Window`)
- [ ] Frontend end-to-end tests (real browser against a real backend) — see KAN-87
- [ ] `packages/core` — purpose undefined, decide before adding files
- [ ] `packages/shared` — empty, needed once a 2nd backend module or frontend utilities appear
- [x] `packages/ui` — thin scope built (KAN-75, KAN-80, and every ticket
      since that needed a new primitive): Button, Checkbox, CommandPalette,
      Form/FormActions, Icon, Input, Link, Modal, Select, Tabs, Textarea,
      Window. Tables and general layout primitives still not started — pick
      up alongside the ticket that needs them
- [ ] Repository implementations currently live in `apps/api/src/modules/entities/infrastructure` instead of `packages/database` — documented deviation from target architecture in AGENTS.md
