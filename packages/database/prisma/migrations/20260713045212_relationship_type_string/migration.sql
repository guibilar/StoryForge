-- AlterTable
ALTER TABLE "Relationship" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;

-- DropEnum
DROP TYPE "RelationshipType";
