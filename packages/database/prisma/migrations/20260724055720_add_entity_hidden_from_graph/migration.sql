-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "hiddenFromGraph" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: CHARACTER entities always appear in the relationship graph (see
-- packages/domain's Entity.validateHiddenFromGraph), so existing rows need
-- correcting back to false even though the column default is true.
UPDATE "Entity" SET "hiddenFromGraph" = false WHERE "category" = 'CHARACTER';
