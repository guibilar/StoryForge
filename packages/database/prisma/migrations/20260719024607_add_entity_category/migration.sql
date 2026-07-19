-- CreateEnum
CREATE TYPE "EntityCategory" AS ENUM ('CHARACTER', 'LOCATION', 'ORGANIZATION', 'ITEM', 'OTHER');

-- AlterTable: add nullable first so existing rows can be backfilled before
-- the NOT NULL constraint is applied (KAN-118).
ALTER TABLE "Entity" ADD COLUMN "category" "EntityCategory";

-- Backfill: best-effort case-insensitive match against the existing
-- free-string `type` column. This is a one-time heuristic, not a permanent
-- mapping — anything that doesn't match falls through to OTHER, the
-- deliberate safe default so this migration never blocks on a guess.
UPDATE "Entity"
SET "category" = 'CHARACTER'
WHERE lower(trim("type")) IN ('character', 'characters', 'npc', 'npcs', 'pc', 'pcs', 'player', 'player character', 'monster', 'creature');

UPDATE "Entity"
SET "category" = 'LOCATION'
WHERE "category" IS NULL
  AND lower(trim("type")) IN ('location', 'locations', 'place', 'city', 'town', 'village', 'dungeon', 'building', 'region', 'district');

UPDATE "Entity"
SET "category" = 'ORGANIZATION'
WHERE "category" IS NULL
  AND lower(trim("type")) IN ('organization', 'organizations', 'organisation', 'faction', 'factions', 'guild', 'clan', 'cult', 'government', 'party');

UPDATE "Entity"
SET "category" = 'ITEM'
WHERE "category" IS NULL
  AND lower(trim("type")) IN ('item', 'items', 'artifact', 'weapon', 'equipment');

UPDATE "Entity"
SET "category" = 'OTHER'
WHERE "category" IS NULL;

-- AlterTable: now safe to enforce.
ALTER TABLE "Entity" ALTER COLUMN "category" SET NOT NULL;
