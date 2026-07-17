-- CreateTable
CREATE TABLE "SessionAttendee" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionAttendee_sessionId_idx" ON "SessionAttendee"("sessionId");

-- CreateIndex
CREATE INDEX "SessionAttendee_userId_idx" ON "SessionAttendee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionAttendee_sessionId_userId_key" ON "SessionAttendee"("sessionId", "userId");

-- AddForeignKey
ALTER TABLE "SessionAttendee" ADD CONSTRAINT "SessionAttendee_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAttendee" ADD CONSTRAINT "SessionAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
