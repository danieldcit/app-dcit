import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi, seedResponse } from "./test-session";

const DASHBOARD_NOT_CONFIGURED = {
  headcountTotal: 5,
  headcountPorTipo: { CLT: 3, PJ: 1, terceirizado: 1, naoClassificado: 0 },
  custoBase: 25000,
  custoBeneficios: 2000,
  encargos: null,
  encargosConfigurados: false,
  custoMensalTotal: 27000,
  custoMedioPorColaborador: 5400,
  colaboradoresSemSalario: 0,
};

const DASHBOARD_CONFIGURED = {
  ...DASHBOARD_NOT_CONFIGURED,
  encargos: 5000,
  encargosConfigurados: true,
};

test.describe("Fiscal & Tributos 2026", () => {
  test("gestor configures fiscal parameters and sees the dashboard update", async ({ page, context, request }) => {
    await addSessionCookie(context);
    await mockApi(request, { employees: [] });
    await seedResponse(request, { method: "GET", path: "/fiscal/dashboard", response: DASHBOARD_NOT_CONFIGURED });
    await seedResponse(request, { method: "GET", path: "/fiscal/parametros", response: null });

    await page.goto("/fiscal-tributos");
    await expect(page.getByRole("heading", { name: "Fiscal & Tributos 2026" })).toBeVisible();
    await expect(page.getByText("Configure os parâmetros fiscais")).toBeVisible();

    await page.getByRole("link", { name: "Configurar parâmetros fiscais" }).click();
    await expect(page.getByRole("heading", { name: "Parâmetros Fiscais" })).toBeVisible();

    await seedResponse(request, { method: "POST", path: "/fiscal/parametros", response: {} });

    await page.getByLabel("INSS patronal (%)").fill("20");
    await page.getByLabel(/RAT \(%\)/).fill("2");
    await page.getByLabel("FGTS (%)").fill("8");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Parâmetros salvos.")).toBeVisible();

    // Simulate the API now reflecting the saved parameters, so the dashboard
    // reload below exercises the "configured" branch instead of re-serving
    // the same canned response the initial GET used.
    await seedResponse(request, { method: "GET", path: "/fiscal/dashboard", response: DASHBOARD_CONFIGURED });

    await page.goto("/fiscal-tributos");
    await expect(page.getByText("Configure os parâmetros fiscais")).not.toBeVisible();
  });

  test("rh cannot access the fiscal module", async ({ page, context }) => {
    await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Rita RH" });

    await page.goto("/fiscal-tributos");
    await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
  });
});
