-- CreateTable
CREATE TABLE "FiscalCostSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" DATETIME NOT NULL,
    "team" TEXT,
    "tipoContratacao" TEXT,
    "headcountTotal" INTEGER NOT NULL,
    "custoBase" REAL NOT NULL,
    "custoBeneficios" REAL NOT NULL,
    "encargos" REAL,
    "custoMensalTotal" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalCostSnapshot_month_team_tipoContratacao_key" ON "FiscalCostSnapshot"("month", "team", "tipoContratacao");
