-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OnboardingAccessGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "grantedByName" TEXT
);
INSERT INTO "new_OnboardingAccessGrant" ("id", "userId", "grantedAt", "source", "grantedByName") SELECT "id", "userId", "grantedAt", "source", "grantedByName" FROM "OnboardingAccessGrant";
DROP TABLE "OnboardingAccessGrant";
ALTER TABLE "new_OnboardingAccessGrant" RENAME TO "OnboardingAccessGrant";
CREATE UNIQUE INDEX "OnboardingAccessGrant_userId_key" ON "OnboardingAccessGrant"("userId");
PRAGMA foreign_keys=ON;
