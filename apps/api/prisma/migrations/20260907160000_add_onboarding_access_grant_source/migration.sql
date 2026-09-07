-- AlterTable
ALTER TABLE "OnboardingAccessGrant" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "OnboardingAccessGrant" ADD COLUMN "grantedByName" TEXT;
