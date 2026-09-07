-- AlterTable
ALTER TABLE "OnboardingTask" ADD COLUMN "requiresContract" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SignedContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fileDataUrl" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SignedContract_userId_key" ON "SignedContract"("userId");
