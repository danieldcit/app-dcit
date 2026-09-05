-- AlterTable
ALTER TABLE "AdmissionDocument" ADD COLUMN "kind" TEXT;
ALTER TABLE "AdmissionDocument" ADD COLUMN "photoUri2" TEXT;
ALTER TABLE "AdmissionDocument" ADD COLUMN "photoUri3" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionDocument_userId_kind_key" ON "AdmissionDocument"("userId", "kind");
