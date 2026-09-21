import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";

const DASHBOARD_NOT_CONFIGURED = {
  headcountTotal: 5,
  headcountPorTipo: { CLT: 3, PJ: 1, terceirizado: 1, naoClassificado: 0 },
  custoBase: 25000,
  custoBeneficios: 2000,
  encargos: null,
  encargosConfigurados: false,
  encargosPercentual: null,
  encargosBreakdown: null,
  encargosPercentuais: null,
  folhaCLTConsiderada: 0,
  cltComSalario: 0,
  custoMensalTotal: 27000,
  custoMedioPorColaborador: 5400,
  custoMedioComDadosCompletos: 5400,
  custosPorColaborador: [],
  variacaoCustoMensalPercent: null,
  variacaoCustoMedioPercent: null,
  colaboradoresSemSalario: 0,
  naoClassificados: [],
  semSalario: [],
  parametrosAtualizadoEm: null,
  parametrosVigenciaData: null,
  historico: [],
  historicoCombinacaoNaoSuportada: false,
};

const DASHBOARD_CONFIGURED = {
  ...DASHBOARD_NOT_CONFIGURED,
  encargos: 5600,
  encargosConfigurados: true,
  encargosPercentual: 35,
  encargosBreakdown: { inssPatronal: 3200, rat: 320, terceiros: 800, fgts: 1280, total: 5600 },
  encargosPercentuais: { inssPatronal: 20, rat: 2, terceiros: 5, fgts: 8 },
  folhaCLTConsiderada: 16000,
  cltComSalario: 3,
  variacaoCustoMensalPercent: 12.5,
  variacaoCustoMedioPercent: -2.1,
  custosPorColaborador: [
    {
      userId: "colaborador-1",
      name: "João",
      tipoContratacao: "CLT",
      salarioMensal: 5000,
      encargos: 1750,
      encargosBreakdown: { inssPatronal: 1000, rat: 100, terceiros: 250, fgts: 400, total: 1750 },
      beneficios: 500,
      custoTotal: 7250,
    },
    {
      userId: "colaborador-2",
      name: "Maria PJ",
      tipoContratacao: "PJ",
      salarioMensal: 4000,
      encargos: null,
      encargosBreakdown: null,
      beneficios: 0,
      custoTotal: 4000,
    },
    {
      userId: "colaborador-3",
      name: "Bruno Gestor",
      tipoContratacao: "CLT",
      salarioMensal: null,
      encargos: null,
      encargosBreakdown: null,
      beneficios: 0,
      custoTotal: 0,
    },
  ],
  parametrosAtualizadoEm: "2026-09-01T12:00:00.000Z",
  parametrosVigenciaData: "2026-01-01T00:00:00.000Z",
  historico: [
    { month: "2026-08-01T00:00:00.000Z", custoMensalTotal: 26000, headcountTotal: 5 },
    { month: "2026-09-01T00:00:00.000Z", custoMensalTotal: 32000, headcountTotal: 5 },
  ],
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
    await expect(page.getByText("Base: 5 colaborador(es)")).toBeVisible();

    const alertasCard = page.locator("section", { hasText: "⚠️ Alertas" });
    await expect(alertasCard.getByText("Parâmetros fiscais não configurados")).toBeVisible();
    await expect(alertasCard.getByRole("link", { name: "Configurar parâmetros →" })).toBeVisible();

    const trendCard = page.locator("section", { hasText: "Evolução do custo da equipe" });
    await expect(trendCard.getByText("Ainda não há histórico suficiente para gerar o gráfico.")).toBeVisible();

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
    // Scoped to the "Encargos e obrigações governamentais" card. getByText
    // uses substring matching (not exact), since each row also carries the
    // aliquota in parentheses after the currency value.
    const encargosCard = page.locator("section", { hasText: "Encargos e obrigações governamentais" });
    // .first(): the same total also appears inside the (closed) consolidated
    // dialog rendered as a sibling in this card — getByText resolves matches
    // regardless of visibility, so an unscoped locator here is ambiguous.
    await expect(encargosCard.getByText("R$ 5.600,00 / mês").first()).toBeVisible();
    await expect(encargosCard.getByText("INSS patronal", { exact: true })).toBeVisible();
    await expect(encargosCard.getByText(`R$ 3.200,00 (20%)`)).toBeVisible();
    await expect(encargosCard.getByText(`R$ 320,00 (2% - Risco Médio)`)).toBeVisible();
    await expect(encargosCard.getByText("Terceiros / Sistema S", { exact: true })).toBeVisible();
    await expect(encargosCard.getByText(`R$ 800,00 (5%)`)).toBeVisible();
    await expect(encargosCard.getByText(`R$ 1.280,00 (8%)`)).toBeVisible();
    await expect(encargosCard.getByText("35% sobre a folha CLT considerada")).toBeVisible();
    await expect(encargosCard.getByText("Base considerada: R$ 16.000,00")).toBeVisible();
    const custoMensalCard = page.locator("section", { hasText: "Custo mensal da equipe" });
    await expect(custoMensalCard.getByText("↑ 12,5% vs. mês anterior")).toBeVisible();
    const custoMedioCard = page.locator("section", { hasText: "Custo médio por colaborador" });
    await expect(custoMedioCard.getByText("↓ 2,1% vs. mês anterior")).toBeVisible();

    await expect(page.getByText(/Dados atualizados em/)).toBeVisible();
    await expect(page.getByText(/Parâmetros tributários atualizados em/)).toBeVisible();
    await expect(page.getByText(/Vigência legal desde/)).toBeVisible();

    const headcountCard = page.locator("section", { hasText: "Headcount" }).first();
    await expect(headcountCard.getByText("3 (60%)")).toBeVisible();

    await expect(trendCard.getByText("ago/26")).toBeVisible();
    await expect(trendCard.getByText("set/26")).toBeVisible();

    const composicaoCard = page.locator("section", { hasText: "Composição do custo" });
    await expect(composicaoCard.getByText(/Salários\/contratos/)).toBeVisible();

    const colaboradorCostCard = page.locator("section", { hasText: "Custo por colaborador" });
    await expect(colaboradorCostCard.getByText("João")).toBeVisible();
    await expect(colaboradorCostCard.getByText("Maria PJ")).toBeVisible();
    // Detalhamento de encargos direto na tabela — não só no modal consolidado.
    await expect(colaboradorCostCard.getByRole("columnheader", { name: "INSS Patronal" })).toBeVisible();
    await expect(colaboradorCostCard.getByRole("columnheader", { name: "RAT" })).toBeVisible();
    await expect(colaboradorCostCard.getByRole("columnheader", { name: "Terceiros" })).toBeVisible();
    await expect(colaboradorCostCard.getByRole("columnheader", { name: "FGTS" })).toBeVisible();
    await expect(colaboradorCostCard.getByRole("columnheader", { name: "Total Encargos" })).toBeVisible();
    const joaoRow = page.getByRole("button", { name: /João/ });
    await expect(joaoRow.getByText("R$ 1.000,00", { exact: true })).toBeVisible();
    await expect(joaoRow.getByText("R$ 100,00", { exact: true })).toBeVisible();
    await expect(joaoRow.getByText("R$ 250,00", { exact: true })).toBeVisible();
    await expect(joaoRow.getByText("R$ 400,00", { exact: true })).toBeVisible();

    await expect(alertasCard.getByText("✅ Nenhuma pendência encontrada")).toBeVisible();
  });

  test("encargos card opens a consolidated (company-wide) breakdown dialog, with no per-employee data", async ({
    page,
    context,
    request,
  }) => {
    await addSessionCookie(context);
    await mockApi(request, {});
    await seedResponse(request, { method: "GET", path: "/fiscal/dashboard", response: DASHBOARD_CONFIGURED });

    await page.goto("/fiscal-tributos");

    const encargosCard = page.locator("section", { hasText: "Encargos e obrigações governamentais" });
    await expect(
      encargosCard.getByText("?", { exact: true })
    ).toHaveAttribute("title", /Soma apenas o sal.rio dos 3 colaborador/);

    await encargosCard.getByRole("button", { name: "Ver memória de cálculo →" }).click();
    const dialog = page.getByText("Detalhamento de Encargos Governamentais (Consolidado)").locator("..");
    await expect(dialog.getByText("Base de Cálculo Total (Folha CLT): R$ 16.000,00")).toBeVisible();
    await expect(dialog.getByText("Composição dos Tributos:")).toBeVisible();
    await expect(dialog.getByText(/INSS Patronal \(20%\)/)).toBeVisible();
    await expect(dialog.getByText("R$ 3.200,00", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/RAT \(2% - Risco Médio\)/)).toBeVisible();
    await expect(dialog.getByText("R$ 320,00", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/FGTS \(8%\)/)).toBeVisible();
    await expect(dialog.getByText("R$ 1.280,00", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Total Geral de Encargos Governamentais:")).toBeVisible();
    await expect(dialog.getByText("R$ 5.600,00 / mês")).toBeVisible();

    // Estritamente consolidado — nenhum nome de colaborador aparece aqui;
    // detalhamento por pessoa fica só na tabela "Custo por colaborador".
    await expect(dialog.getByText("João", { exact: true })).not.toBeVisible();
    await expect(dialog.getByText("Maria PJ", { exact: true })).not.toBeVisible();
  });

  test("Custo por colaborador row opens a dialog with that person's memória de cálculo", async ({
    page,
    context,
    request,
  }) => {
    await addSessionCookie(context);
    await mockApi(request, {});
    await seedResponse(request, { method: "GET", path: "/fiscal/dashboard", response: DASHBOARD_CONFIGURED });

    await page.goto("/fiscal-tributos");

    await page.getByRole("button", { name: /João/ }).click();
    await expect(page.getByText("João — memória de cálculo")).toBeVisible();
    // encargos 1750 / salário 5000 = 35%
    await expect(page.getByText("35% de encargos sobre o salário bruto")).toBeVisible();
  });

  test("Custo por colaborador shows a pending status (not zeroed values) for CLT staff with no salário cadastrado", async ({
    page,
    context,
    request,
  }) => {
    await addSessionCookie(context);
    await mockApi(request, {});
    await seedResponse(request, { method: "GET", path: "/fiscal/dashboard", response: DASHBOARD_CONFIGURED });

    await page.goto("/fiscal-tributos");

    const colaboradorCostCard = page.locator("section", { hasText: "Custo por colaborador" });
    await expect(colaboradorCostCard.getByText("⏳ Aguardando cadastro de salário")).toBeVisible();

    // A linha pendente não deve virar um botão clicável (não há memória de
    // cálculo pra mostrar sem salário cadastrado).
    await expect(page.getByRole("button", { name: /Bruno Gestor/ })).toHaveCount(0);
  });

  test("cost trend chart shows a message when team and tipoContratacao filters are combined", async ({
    page,
    context,
    request,
  }) => {
    await addSessionCookie(context);
    await mockApi(request, {});
    await seedResponse(request, {
      method: "GET",
      path: "/fiscal/dashboard",
      response: { ...DASHBOARD_NOT_CONFIGURED, historicoCombinacaoNaoSuportada: true },
    });

    await page.goto("/fiscal-tributos?team=alpha&tipoContratacao=CLT");

    const trendCard = page.locator("section", { hasText: "Evolução do custo da equipe" });
    await expect(
      trendCard.getByText("Selecione apenas time OU tipo de contratação para ver a evolução histórica.")
    ).toBeVisible();

    // Equipe é um <select> (sempre mostra todas as opções, ao contrário de
    // um <input list> com datalist, que filtra pelo texto já digitado) — e
    // inclui o valor do filtro em vigor ("alpha") mesmo fora das 4 sugestões,
    // pra não "sumir" o filtro atual da lista.
    const teamSelect = page.locator("#team");
    await expect(teamSelect).toHaveValue("alpha");
    const optionValues = await teamSelect.locator("option").allTextContents();
    expect(optionValues).toEqual(
      expect.arrayContaining(["Todos", "alpha", "SG MONITOR", "SGN 360", "SGM365", "SGP PORTAL"])
    );
  });

  test("Alertas card lists pending data issues with links to fix them", async ({ page, context, request }) => {
    await addSessionCookie(context);
    await mockApi(request, {});
    await seedResponse(request, {
      method: "GET",
      path: "/fiscal/dashboard",
      response: {
        ...DASHBOARD_NOT_CONFIGURED,
        colaboradoresSemSalario: 3,
        semSalario: [
          { userId: "colaborador-2", name: "Bia" },
          { userId: "colaborador-3", name: "Caio" },
          { userId: "colaborador-4", name: "Duda" },
        ],
        naoClassificados: [{ userId: "colaborador-1", name: "Ana Colaboradora" }],
      },
    });

    await page.goto("/fiscal-tributos");

    const alertasCard = page.locator("section", { hasText: "⚠️ Alertas" });
    await expect(alertasCard.getByText("3", { exact: true })).toBeVisible();
    await expect(alertasCard.getByText("3 colaborador(es) sem salário cadastrado")).toBeVisible();
    await expect(alertasCard.getByText("1 colaborador(es) sem tipo de contratação classificado")).toBeVisible();
    await expect(alertasCard.getByRole("link", { name: "Atualizar cadastros →" })).toHaveAttribute(
      "href",
      "/colaboradores?semSalario=colaborador-2,colaborador-3,colaborador-4"
    );
    await expect(alertasCard.getByRole("link", { name: "Classificar agora →" })).toHaveAttribute(
      "href",
      "#nao-classificados"
    );
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
