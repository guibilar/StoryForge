-- Optional link from a map feature to the Entity it represents (KAN-116).
-- ON DELETE SET NULL, not CASCADE: deleting the entity clears the link and
-- leaves the marker/territory on the map, since a map annotation shouldn't
-- disappear because someone tidied up world data.

-- AlterTable
ALTER TABLE "Marker" ADD COLUMN "entityId" TEXT;

-- AlterTable
ALTER TABLE "Territory" ADD COLUMN "entityId" TEXT;

-- CreateIndex
CREATE INDEX "Marker_entityId_idx" ON "Marker"("entityId");

-- CreateIndex
CREATE INDEX "Territory_entityId_idx" ON "Territory"("entityId");

-- AddForeignKey
ALTER TABLE "Marker" ADD CONSTRAINT "Marker_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
