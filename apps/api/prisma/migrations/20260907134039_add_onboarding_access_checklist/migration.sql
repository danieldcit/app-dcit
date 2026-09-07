-- AlterTable
ALTER TABLE "OnboardingTask" ADD COLUMN "requiresAccessChecklist" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OnboardingAccessItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingAccessItem_userId_itemKey_key" ON "OnboardingAccessItem"("userId", "itemKey");
