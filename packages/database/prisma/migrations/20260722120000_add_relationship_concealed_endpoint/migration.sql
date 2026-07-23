-- CreateEnum
CREATE TYPE "RelationshipEndpoint" AS ENUM ('SOURCE', 'TARGET');

-- AlterTable
-- Nullable, no default: null means fully revealed, which is what every
-- existing relationship already is — no backfill needed.
ALTER TABLE "Relationship" ADD COLUMN "concealedEndpoint" "RelationshipEndpoint";
