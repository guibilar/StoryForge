/*
  Warnings:

  - Changed the type of `type` on the `Relationship` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('MEMBER_OF', 'OWNS', 'ENEMY', 'ALLY', 'PARENT', 'CHILD');

-- AlterTable
ALTER TABLE "Relationship" DROP COLUMN "type",
ADD COLUMN     "type" "RelationshipType" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Relationship_campaignId_sourceEntityId_targetEntityId_type_key" ON "Relationship"("campaignId", "sourceEntityId", "targetEntityId", "type");
