-- CreateTable
CREATE TABLE "OnboardingAccessGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingAccessGrant_userId_key" ON "OnboardingAccessGrant"("userId");
