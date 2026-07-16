-- Replace full-table unique constraints with partial unique indexes that
-- exclude soft-deleted rows, so a soft-deleted record no longer blocks
-- recreating a row with the same natural key. Also add a real DB-level
-- unique constraint on Campaign.name to close a TOCTOU race that let
-- concurrent creates slip past the application-level uniqueness check.

DROP INDEX "Entity_campaignId_name_key";
CREATE UNIQUE INDEX "Entity_campaignId_name_key" ON "Entity"("campaignId", "name") WHERE "deletedAt" IS NULL;

DROP INDEX "Relationship_campaignId_sourceEntityId_targetEntityId_type_key";
CREATE UNIQUE INDEX "Relationship_campaignId_sourceEntityId_targetEntityId_type_key" ON "Relationship"("campaignId", "sourceEntityId", "targetEntityId", "type") WHERE "deletedAt" IS NULL;

-- AddUniqueConstraint
CREATE UNIQUE INDEX "Campaign_name_key" ON "Campaign"("name");
