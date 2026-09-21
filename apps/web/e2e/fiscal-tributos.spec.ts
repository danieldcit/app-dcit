import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";

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
  naoClassificados: [],
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
    // Intl.NumberFormat("pt-BR", { currency: "BRL" }) separates the symbol
    // from the amount with a non-breaking space (U+00A0), not a regular one.
    // Scoped to the "Impacto tributário estimado" card and matched exactly:
    // the "Custo mensal da equipe" card's "Encargos (CLT): R$ 5.000,00" line
    // also contains this substring (same encargos value), so an unscoped,
    // non-exact match is ambiguous.
    const impactoCard = page.locator("section", { hasText: "Impacto tributário estimado" });
    await expect(impactoCard.getByText("R$ 5.000,00", { exact: true })).toBeVisible();
  });

  test("rh cannot access the fiscal module", async ({ page, context }) => {
    await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Rita RH" });

    await page.goto("/fiscal-tributos");
    await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
  });

  test("gestor classifies an unclassified employee", async ({ page, context, request }) => {
    await addSessionCookie(context);
    // Reset the shared fake-api-server state first: this test doesn't call
    // mockApi() for its own seeding, but workers: 1 means the server's
    // in-memory seeded responses and recordedRequests log persist across
    // tests, and the poll below would false-positive on a leftover PATCH
    // recorded by an earlier test.
    await mockApi(request, {});
    await seedResponse(request, {
      method: "GET",
      path: "/fiscal/dashboard",
      response: {
        ...DASHBOARD_NOT_CONFIGURED,
        naoClassificados: [{ userId: "colaborador-1", name: "Ana Colaboradora" }],
      },
    });

    await page.goto("/fiscal-tributos");
    await expect(page.getByText("Colaboradores não classificados (1)")).toBeVisible();
    await expect(page.getByText("Ana Colaboradora")).toBeVisible();

    // getByRole("combobox") alone is ambiguous here: the filter form above
    // also has a <select name="tipoContratacao">. Scope to the row for this
    // employee first.
    const row = page.getByText("Ana Colaboradora").locator("..");
    await row.getByRole("combobox").selectOption("CLT");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect
      .poll(async () => {
        const requests = await getRecordedRequests(request);
        return requests.some(
          (r) =>
            r.method === "PATCH" &&
            r.path === "/employees/colaborador-1/tipo-contratacao" &&
            (r.body as { tipoContratacao?: string })?.tipoContratacao === "CLT"
        );
      })
      .toBe(true);
  });
});
