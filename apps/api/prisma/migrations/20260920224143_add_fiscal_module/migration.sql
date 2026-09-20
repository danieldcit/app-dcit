-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "tipoContratacao" TEXT;

-- CreateTable
CREATE TABLE "FiscalParameters" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "inssPatronalPercent" REAL,
    "ratPercent" REAL,
    "fgtsPercent" REAL,
    "sujeitoDesoneracaoFolha" BOOLEAN,
    "fonteLegal" TEXT,
    "vigenciaData" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    "updatedByUserId" TEXT
);
