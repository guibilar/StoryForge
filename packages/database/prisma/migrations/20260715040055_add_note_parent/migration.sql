-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "parentNoteId" TEXT;

-- CreateIndex
CREATE INDEX "Note_parentNoteId_idx" ON "Note"("parentNoteId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_parentNoteId_fkey" FOREIGN KEY ("parentNoteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
