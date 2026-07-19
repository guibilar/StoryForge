-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "ownerUserId" TEXT;

-- CreateIndex
CREATE INDEX "Entity_ownerUserId_idx" ON "Entity"("ownerUserId");

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
