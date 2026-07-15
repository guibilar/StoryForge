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
- [x] Test suite — 203 tests via Vitest across `packages/domain` (entities,
      value objects, tags, relationships) and `apps/api` (application services
      w/ mocked repos, Prisma mappers, GraphQL resolvers, and Prisma repository
      integration tests against a real Postgres). See AGENTS.md "Testing"
      section for layout and gotchas.

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
      all guarded via `requireCurrentUser` (KAN-83)
- [x] Entity soft delete
- [x] Duplicate-name validation per campaign
- [x] Generic `type` field (Character/Location/Organization via type string, no type-specific schema)
- [x] Portrait / image upload — `uploadEntityImage` mutation (GraphQL multipart
      request spec), `LocalImageStore` (validates JPEG/PNG/GIF/WEBP, 5MB limit,
      writes to `UPLOADS_DIR/<entityId>/<uuid>.<ext>`), guarded via `requireCurrentUser`
- [x] Tags (KAN-37) — campaign-scoped `Tag`/`EntityTag` join model (reusable
      across entities in a campaign, name normalized trim+lowercase);
      `addTagToEntity`/`removeTagFromEntity` GraphQL mutations (find-or-create
      by name, idempotent attach/detach), `campaignTags` query, `Entity.tags`
      field — all three guarded via `requireCurrentUser` (KAN-83)
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
      (all five guarded via `requireCurrentUser`, KAN-83). Directional-only for v1 —
      Ally/Enemy do not auto-create an inverse edge (deferred, not needed yet).
      No nested `sourceEntity`/`targetEntity` field resolvers — GraphQL type
      exposes raw IDs only. `type` is a validated free string (like
      `Entity.type`), not a closed enum — KAN-41 originally made it a TS/Prisma
      enum, reverted so future plugins (e.g. the VTM plugin's Sire/Childe/Ghoul
      relationship types) can define their own values without a core migration.
- [ ] Graph visualization (React Flow)

## Notes & Assets

- [ ] Rich text / markdown notes
- [ ] Attachments, images
- [ ] Internal links between notes/entities
- [ ] Nested notes

## Sessions & Timeline

- [ ] Session model (number, date, summary)
- [ ] Event model (timeline, participants, related entities)
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
