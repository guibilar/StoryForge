-- CreateEnum
CREATE TYPE "RelationshipVisibility" AS ENUM ('PUBLIC', 'STORYTELLER', 'TARGETED');

-- AlterTable
-- Existing rows default to PUBLIC, preserving today's behaviour: they stay
-- as visible as the two entities they connect (the endpoint rule still
-- applies on top of this column).
ALTER TABLE "Relationship" ADD COLUMN "visibility" "RelationshipVisibility" NOT NULL DEFAULT 'PUBLIC';

-- CreateTable
CREATE TABLE "RelationshipRecipient" (
    "id" TEXT NOT NULL,
    "relationshipId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelationshipRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RelationshipRecipient_relationshipId_userId_key" ON "RelationshipRecipient"("relationshipId", "userId");

-- CreateIndex
CREATE INDEX "RelationshipRecipient_relationshipId_idx" ON "RelationshipRecipient"("relationshipId");

-- CreateIndex
CREATE INDEX "RelationshipRecipient_userId_idx" ON "RelationshipRecipient"("userId");

-- AddForeignKey
ALTER TABLE "RelationshipRecipient" ADD CONSTRAINT "RelationshipRecipient_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipRecipient" ADD CONSTRAINT "RelationshipRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
