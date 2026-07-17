-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "occurredAt" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "Entity_campaignId_name_idx" ON "Entity"("campaignId", "name");

-- CreateIndex
CREATE INDEX "Relationship_campaignId_sourceEntityId_targetEntityId_type_idx" ON "Relationship"("campaignId", "sourceEntityId", "targetEntityId", "type");
