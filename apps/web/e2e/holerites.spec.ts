import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi } from "./test-session";

test("colaborador sees their own holerites, read-only", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    myHolerites: [
      { id: "hol-1", label: "Agosto 2026", gross: 6200, inss: 682, irrf: 410, benefits: 380 },
    ],
  });

  await page.goto("/holerites");

  await expect(page.getByRole("heading", { name: "Holerites" })).toBeVisible();
  await expect(page.getByText("Agosto 2026")).toBeVisible();
  await expect(page.getByText(/Bruto: R\$\s?6\.200,00/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Excluir" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Baixar PDF" })).toHaveAttribute(
    "href",
    "/api/documentos/holerites/hol-1/arquivo",
  );
});

test("shows an empty state when colaborador has no holerites yet", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myHolerites: [] });

  await page.goto("/holerites");

  await expect(
    page.getByText("Seus holerites vão aparecer aqui assim que o RH lançar o primeiro."),
  ).toBeVisible();
});

test("gestor sees the holerites list", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request, {
    holerites: [
      {
        id: "hol-1",
        userId: "user-1",
        userName: "Fernanda Colaboradora",
        label: "Agosto/2026",
        gross: 6200,
        inss: 682,
        irrf: 410,
        benefits: 380,
      },
    ],
  });

  await page.goto("/holerites");

  await expect(page.getByRole("heading", { name: "Holerites" })).toBeVisible();
  await expect(page.getByText("Fernanda Colaboradora (1)", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Fernanda Colaboradora · Agosto/2026", { exact: true })
  ).not.toBeVisible();

  await page.getByText("Fernanda Colaboradora (1)", { exact: true }).click();

  await expect(
    page.getByText("Fernanda Colaboradora · Agosto/2026", { exact: true })
  ).toBeVisible();
  await expect(page.getByText(/Bruto: R\$\s?6\.200,00/)).toBeVisible();
  await expect(page.getByText(/Líquido: R\$\s?4\.728,00/)).toBeVisible();
});

test("groups holerites by colaborador instead of listing them all flat", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request, {
    holerites: [
      {
        id: "hol-1",
        userId: "user-1",
        userName: "Fernanda Colaboradora",
        label: "Agosto/2026",
        gross: 6200,
        inss: 682,
        irrf: 410,
        benefits: 380,
      },
      {
        id: "hol-2",
        userId: "user-1",
        userName: "Fernanda Colaboradora",
        label: "Setembro/2026",
        gross: 6200,
        inss: 682,
        irrf: 410,
        benefits: 380,
      },
      {
        id: "hol-3",
        userId: "user-2",
        userName: "Gustavo Colaborador",
        label: "Agosto/2026",
        gross: 5000,
        inss: 550,
        irrf: 200,
        benefits: 300,
      },
    ],
  });

  await page.goto("/holerites");

  await expect(page.getByText("Fernanda Colaboradora (2)", { exact: true })).toBeVisible();
  await expect(page.getByText("Gustavo Colaborador (1)", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Fernanda Colaboradora · Agosto/2026", { exact: true })
  ).not.toBeVisible();

  await page.getByText("Gustavo Colaborador (1)", { exact: true }).click();

  await expect(
    page.getByText("Gustavo Colaborador · Agosto/2026", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("Fernanda Colaboradora · Agosto/2026", { exact: true })
  ).not.toBeVisible();
});

test("shows an empty state when no holerite is cadastrado", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, { holerites: [] });

  await page.goto("/holerites");

  await expect(page.getByText("Nenhum holerite cadastrado ainda.")).toBeVisible();
});

test("opens the dialog and creates a new holerite with the API", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    holerites: [],
    employees: [{ userId: "user-1", name: "Fernanda Colaboradora" }],
  });

  await page.goto("/holerites");
  await page.getByRole("button", { name: "+ Novo holerite" }).click();
  await page.getByRole("dialog").getByLabel("Colaborador").selectOption("user-1");
  await page.getByLabel("Rótulo").fill("Setembro/2026");
  await page.getByLabel("Bruto (R$)").fill("6200");
  await page.getByLabel("INSS (R$)").fill("682");
  await page.getByLabel("IRRF (R$)").fill("410");
  await page.getByLabel("Descontos de benefícios (R$)").fill("380");
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/documentos/holerites")
        ?.body;
    })
    .toEqual({
      userId: "user-1",
      label: "Setembro/2026",
      gross: "6200",
      inss: "682",
      irrf: "410",
      benefits: "380",
    });
});

test("editing a holerite calls the API with the updated values", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    holerites: [
      {
        id: "hol-edit",
        userId: "user-1",
        userName: "Fernanda Colaboradora",
        label: "Agosto/2026",
        gross: 6200,
        inss: 682,
        irrf: 410,
        benefits: 380,
      },
    ],
  });

  await page.goto("/holerites");
  await page.getByText("Fernanda Colaboradora (1)", { exact: true }).click();
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByRole("dialog").getByLabel("Bruto (R$)").fill("6500");
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "PATCH" && r.path === "/documentos/holerites/hol-edit",
      )?.body;
    })
    .toEqual({
      label: "Agosto/2026",
      gross: "6500",
      inss: "682",
      irrf: "410",
      benefits: "380",
    });
});

test("removing a holerite calls the API", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    holerites: [
      {
        id: "hol-del",
        userId: "user-1",
        userName: "Fernanda Colaboradora",
        label: "Agosto/2026",
        gross: 6200,
        inss: 682,
        irrf: 410,
        benefits: 380,
      },
    ],
  });

  await page.goto("/holerites");
  await page.getByText("Fernanda Colaboradora (1)", { exact: true }).click();
  await page.getByRole("button", { name: "Excluir" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.some(
        (r) => r.method === "DELETE" && r.path === "/documentos/holerites/hol-del",
      );
    })
    .toBe(true);
});
