# StoryForge — Feature Checklist

Status snapshot generated from repo inspection. Update as work lands — this file
tracks what's actually built, not just planned.

## Foundation

- [x] pnpm workspace + Turborepo
- [x] TypeScript, ESLint, Prettier
- [x] React + Vite frontend scaffold (default, unstyled)
- [x] Fastify / graphql-yoga backend boots
- [x] GraphQL setup (schema merge, context, error mapping)
- [ ] Docker skeleton (`docker/` exists but is empty — no Dockerfile/compose yet)
- [x] CI pipeline (`.github/workflows/ci.yml` — lint, build, test on push/PR
      to main; runs a `postgres:16` service container + `prisma migrate deploy`
      so Prisma repository integration tests run for real, not mocked)
- [x] Husky hooks — pre-commit runs `pnpm test` then `pnpm lint-staged` (KAN-24)
- [x] Test suite — 475 tests via Vitest across `packages/domain` (entities,
      value objects, tags, relationships, notes, note links, sessions,
      events) and `apps/api` (application services w/ mocked repos, Prisma
      mappers, GraphQL resolvers, and Prisma repository integration tests
      against a real Postgres). See AGENTS.md "Testing" section for layout
      and gotchas.

## Authentication & Campaigns

- [x] `User` domain entity + Prisma model
- [x] `Campaign` domain entity + Prisma model
- [x] `CampaignMember` model (KAN-27) — value object on `Campaign`, join table w/ role enum
- [x] AuthenticationService (register/login, bcrypt hashing, JWT) (KAN-28)
- [x] CampaignService (create/update/archive) (KAN-29) — `archiveCampaign`'s
      owner-check now resolves correctly: `CampaignMapper.toDomain` hydrates
      `campaignMembers` via an `include: { members: true }` query (KAN-79)
- [x] GraphQL: `login`, `registerUser`
- [x] GraphQL: `campaigns`, `campaign(id)`, `createCampaign`, `updateCampaign`, `archiveCampaign`
      — all five are guarded (`requireCurrentUser`, KAN-83); `campaigns` is
      also scoped to the caller's own `CampaignMember` rows (KAN-78).
      `createCampaign` now also persists the requesting user as an `OWNER`
      `CampaignMember` row, so newly created campaigns always have an owner.
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
      gated by a new `requireCampaignOwner` guard (`requireCurrentUser` +
      an OWNER-role membership check, looked up directly via the repository)
      mapped to a `ForbiddenError`/`FORBIDDEN` GraphQL error code.
- [ ] Frontend: login, register, dashboard, campaign list, create-campaign dialog, protected routes

## World Building

- [x] Entity CRUD backend (SF-001): service, repository, GraphQL resolvers
      — `entity(id)`, `entities`, `createEntity`, `updateEntity`, `deleteEntity`
      (KAN-83). Upgraded to `requireCampaignMember` (any role) — `entities`
      and `createEntity` check membership on the given `campaignId` directly;
      `entity`/`updateEntity`/`deleteEntity` load the entity first to get its
      `campaignId` since only `id` is given.
- [x] Entity soft delete
- [x] Duplicate-name validation per campaign
- [x] Generic `type` field (Character/Location/Organization via type string, no type-specific schema)
- [x] Portrait / image upload — `uploadEntityImage` mutation (GraphQL multipart
      request spec), `LocalImageStore` (validates JPEG/PNG/GIF/WEBP, 5MB limit,
      writes to `UPLOADS_DIR/<entityId>/<uuid>.<ext>`), guarded via
      `requireCampaignMember` (loads the entity first, same as above)
- [x] Tags (KAN-37) — campaign-scoped `Tag`/`EntityTag` join model (reusable
      across entities in a campaign, name normalized trim+lowercase);
      `addTagToEntity`/`removeTagFromEntity` GraphQL mutations (find-or-create
      by name, idempotent attach/detach), `campaignTags` query, `Entity.tags`
      field. `campaignTags` and both mutations now guarded via
      `requireCampaignMember` (any role), not just `requireCurrentUser` —
      the mutations resolve the entity first (`entityService.getEntity`) to
      derive its `campaignId` before checking membership, since neither
      mutation takes `campaignId` directly.
- [x] Search / filtering — `entities(campaignId, filter: EntityFilter)`
      GraphQL query; `EntityFilter { type, nameContains, tagIds }`, AND-combined
      (`type` exact match, `nameContains` case-insensitive, `tagIds` any-match
      via `EntityTag` join), all fields optional
- [ ] Frontend entity list + form

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
      (all five guarded via `requireCurrentUser`, KAN-83; upgraded to
      `requireCampaignMember` — `relationship`/`updateRelationship`/
      `deleteRelationship` load the relationship first to get its
      `campaignId` since only `id` is given). Directional-only for v1 —
      Ally/Enemy do not auto-create an inverse edge (deferred, not needed yet).
      No nested `sourceEntity`/`targetEntity` field resolvers — GraphQL type
      exposes raw IDs only. `type` is a validated free string (like
      `Entity.type`), not a closed enum — KAN-41 originally made it a TS/Prisma
      enum, reverted so future plugins (e.g. the VTM plugin's Sire/Childe/Ghoul
      relationship types) can define their own values without a core migration.
- [ ] Graph visualization (React Flow)

## Notes & Assets

- [x] Rich text / markdown notes (KAN-43) — `Note` domain entity + `Note`
      Prisma model (`campaignId`/`authorId` FKs, `Cascade`, `content` stored
      as `Text`, soft delete like `Entity`); `NoteService`,
      `PrismaNoteRepository`, `NoteMapper` under `apps/api/src/modules/notes/`;
      GraphQL `note(id)`, `notes(campaignId)`, `createNote`, `updateNote`,
      `deleteNote`, all guarded via a new `requireCampaignMember` guard
      (`campaignMembers/graphql/guards.ts`, any role) rather than plain
      `requireCurrentUser`. `entities`/`relationships`/`tags` were upgraded
      to the same guard afterward, closing the gap across all of World
      Building. `createNote`/`notes` check membership on the input `campaignId`;
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
      `Note` from outside the `notes` module). Client-side rendering into
      clickable links is deferred — `apps/web` is still the unmodified Vite
      scaffold, no Note UI exists yet to extend.
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
      `session(id)`, `sessions(campaignId)`, `createSession`,
      `updateSession`, `deleteSession`, guarded via `requireCampaignMember`.
      Hard delete (no `deletedAt`) — no restore requirement, no dangling
      references possible for a leaf model.
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
      `event(id)`, `events(campaignId)`, `eventsBySession(sessionId)`,
      `createEvent`, `updateEvent`, `deleteEvent`, `attachParticipant`,
      `detachParticipant`; `Event.session` and `Event.participants` are
      field resolvers (mirroring `Note.parent`'s lazy service-call
      pattern), not Prisma includes. Hard delete, same rationale as
      Session.
- [ ] Timeline UI (ordering, filters, search)

## Maps

- [ ] Leaflet integration
- [ ] Markers, territories, regions, districts
- [ ] Custom overlays / images as maps

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

- [ ] Roles (Owner, Storyteller, Co-Storyteller, Player, Observer)
- [ ] Permissions
- [ ] Shared vs private notes, player handouts

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

- [ ] Frontend tests — `apps/web` has no test infra yet (still Vite scaffold)
- [ ] `packages/core` — purpose undefined, decide before adding files
- [ ] `packages/shared` — empty, needed once a 2nd backend module or frontend utilities appear
- [ ] `packages/ui` — empty, needed once frontend work starts
- [ ] Repository implementations currently live in `apps/api/src/modules/entities/infrastructure` instead of `packages/database` — documented deviation from target architecture in AGENTS.md
