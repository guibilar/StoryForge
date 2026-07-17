-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "occurredAt" SET DATA TYPE TEXT;

-- The two indexes below were already declared in schema.prisma (committed
-- separately, unrelated to this migration's occurredAt change) but had no
-- migration file generated for them, so `prisma migrate dev` picked up this
-- pre-existing drift alongside the intended change. Applying them here is
-- correct — it brings the database in line with already-committed schema —
-- but they are not part of KAN-49's scope.

-- CreateIndex
CREATE INDEX "Entity_campaignId_name_idx" ON "Entity"("campaignId", "name");

-- CreateIndex
CREATE INDEX "Relationship_campaignId_sourceEntityId_targetEntityId_type_idx" ON "Relationship"("campaignId", "sourceEntityId", "targetEntityId", "type");
