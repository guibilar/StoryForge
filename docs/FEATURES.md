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
- [x] Test suite — 153 tests via Vitest across `packages/domain` (entities,
      value objects, tags) and `apps/api` (application services w/ mocked repos,
      Prisma mappers, and Prisma repository integration tests against a real
      Postgres). See AGENTS.md "Testing" section for layout and gotchas.

## Authentication & Campaigns

- [x] `User` domain entity + Prisma model
- [x] `Campaign` domain entity + Prisma model
- [x] `CampaignMember` model (KAN-27) — value object on `Campaign`, join table w/ role enum
- [x] AuthenticationService (register/login, bcrypt hashing, JWT) (KAN-28)
- [x] CampaignService (create/update/archive) (KAN-29) — `archiveCampaign`'s
      owner-check always fails: `CampaignMapper.toDomain` never hydrates
      `campaignMembers`, so it's always empty
- [x] GraphQL: `login`, `registerUser`
- [x] GraphQL: `campaigns`, `campaign(id)`, `createCampaign`, `updateCampaign`, `archiveCampaign`
      — the three mutations are guarded (`requireCurrentUser`); the queries are not
- [x] GraphQL: `me` (returns `context.currentUser`, no guard — resolves to `null` when
      logged out rather than throwing)
- [ ] Frontend: login, register, dashboard, campaign list, create-campaign dialog, protected routes

## World Building

- [x] Entity CRUD backend (SF-001): service, repository, GraphQL resolvers
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
      field
- [ ] Search / filtering
- [ ] Frontend entity list + form

## Relationships

- [ ] Relationship domain model
- [ ] Relationship types (MemberOf, Owns, Enemy, Ally, Parent, Child)
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
