---
name: verify
description: Boot the StoryForge GraphQL API against a local Postgres and drive changes over real HTTP. Use to verify apps/api or packages/domain changes end-to-end.
---

# Verifying StoryForge changes at the API surface

## Prereqs (one-time per environment)

1. Postgres 16 reachable at `localhost:5432`. Without Docker, the system
   binaries work: `/usr/lib/postgresql/16/bin/initdb` + `pg_ctl` as the
   `postgres` OS user (data dir must be postgres-owned, e.g. `/var/lib/...`),
   `--auth=trust`, superuser named to match `DATABASE_URL`.
2. `packages/database/.env` → `DATABASE_URL="postgresql://<user>@localhost:5432/storyforge"`,
   then `pnpm -C packages/database exec prisma migrate deploy`.
3. `apps/api/.env` → `JWT_SECRET=<anything>` (fail-fast if missing).

## Launch

```bash
cd apps/api && pnpm exec tsx --env-file=.env src/index.ts
# ready when it prints: StoryForge GraphQL Server running at http://localhost:4000/graphql
```

## Drive

Plain curl against `http://localhost:4000/graphql`; auth is
`authorization: Bearer <token>` (or the `token` cookie).

```bash
GQ() { curl -s http://localhost:4000/graphql -H 'content-type: application/json' \
  ${2:+-H "authorization: Bearer $2"} -d "{\"query\":$(jq -Rs . <<<"$1")}"; }
GQ 'mutation { registerUser(input:{email:"x@example.com", password:"secret1"}) { token user { id } } }'
GQ 'query { campaigns { id name } }' "$TOKEN"
```

Typical flow to reach campaign-scoped resolvers: register two users →
`createCampaign` (as owner) → `addCampaignMember` (by email, pick a role) →
hit the module under test with each role's token. Static uploads are at
`http://localhost:4000/uploads/...`.

## Gotchas

- Campaign names are globally unique — suffix `$RANDOM` in test data.
- Domain errors surface as `extensions.code`: BAD_USER_INPUT / FORBIDDEN /
  UNAUTHENTICATED / NOT_FOUND. A masked "Unexpected error." means an
  unmapped throw — that's a finding, not noise.
