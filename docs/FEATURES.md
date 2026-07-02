# StoryForge — Feature Checklist

Status snapshot generated from repo inspection. Update as work lands — this file
tracks what's actually built, not just planned.

## Foundation

- [x] pnpm workspace + Turborepo
- [x] TypeScript, ESLint, Prettier
- [x] React + Vite frontend scaffold (default, unstyled)
- [x] Fastify / graphql-yoga backend boots
- [x] GraphQL setup (schema merge, context, error mapping)
- [x] Docker skeleton (`docker/` — contents unverified)
- [x] CI pipeline (`.github/workflows/ci.yml` — lint, build, test on push/PR to main)
- [x] Husky hooks — pre-commit runs `pnpm test` then `pnpm lint-staged` (KAN-24)

## Authentication & Campaigns

- [ ] `User` domain entity + Prisma model
- [ ] `Campaign` domain entity (Prisma model exists; domain layer missing)
- [ ] `CampaignMember` model
- [ ] AuthenticationService (register/login, hashing, session/JWT)
- [ ] CampaignService (create/update/archive)
- [ ] GraphQL: `me`, `campaigns`, `campaign(id)`, `register`, `login`, `createCampaign`, `updateCampaign`, `archiveCampaign`
- [ ] Frontend: login, register, dashboard, campaign list, create-campaign dialog, protected routes

## World Building

- [x] Entity CRUD backend (SF-001): service, repository, GraphQL resolvers
- [x] Entity soft delete
- [x] Duplicate-name validation per campaign
- [x] Generic `type` field (Character/Location/Organization via type string, no type-specific schema)
- [ ] Portrait / image upload
- [ ] Tags
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

- [ ] Tests — zero across the repo (no `*.test.ts`/`*.spec.ts` anywhere); backend service/resolver tests and frontend tests both missing
- [ ] `packages/core` — purpose undefined, decide before adding files
- [ ] `packages/shared` — empty, needed once a 2nd backend module or frontend utilities appear
- [ ] `packages/ui` — empty, needed once frontend work starts
- [ ] Repository implementations currently live in `apps/api/src/modules/entities/infrastructure` instead of `packages/database` — documented deviation from target architecture in AGENTS.md
