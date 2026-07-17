-- CreateEnum
CREATE TYPE "NoteVisibility" AS ENUM ('SHARED', 'PRIVATE', 'TARGETED');

-- AlterTable
ALTER TABLE "Note" ADD COLUMN "visibility" "NoteVisibility" NOT NULL DEFAULT 'SHARED';

-- CreateTable
CREATE TABLE "NoteRecipient" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NoteRecipient_noteId_userId_key" ON "NoteRecipient"("noteId", "userId");

-- CreateIndex
CREATE INDEX "NoteRecipient_noteId_idx" ON "NoteRecipient"("noteId");

-- CreateIndex
CREATE INDEX "NoteRecipient_userId_idx" ON "NoteRecipient"("userId");

-- AddForeignKey
ALTER TABLE "NoteRecipient" ADD CONSTRAINT "NoteRecipient_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteRecipient" ADD CONSTRAINT "NoteRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
