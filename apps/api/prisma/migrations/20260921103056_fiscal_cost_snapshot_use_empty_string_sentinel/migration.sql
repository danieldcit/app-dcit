-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FiscalCostSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" DATETIME NOT NULL,
    "team" TEXT NOT NULL DEFAULT '',
    "tipoContratacao" TEXT NOT NULL DEFAULT '',
    "headcountTotal" INTEGER NOT NULL,
    "custoBase" REAL NOT NULL,
    "custoBeneficios" REAL NOT NULL,
    "encargos" REAL,
    "custoMensalTotal" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_FiscalCostSnapshot" ("createdAt", "custoBase", "custoBeneficios", "custoMensalTotal", "encargos", "headcountTotal", "id", "month", "team", "tipoContratacao") SELECT "createdAt", "custoBase", "custoBeneficios", "custoMensalTotal", "encargos", "headcountTotal", "id", "month", coalesce("team", '') AS "team", coalesce("tipoContratacao", '') AS "tipoContratacao" FROM "FiscalCostSnapshot";
DROP TABLE "FiscalCostSnapshot";
ALTER TABLE "new_FiscalCostSnapshot" RENAME TO "FiscalCostSnapshot";
CREATE UNIQUE INDEX "FiscalCostSnapshot_month_team_tipoContratacao_key" ON "FiscalCostSnapshot"("month", "team", "tipoContratacao");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
