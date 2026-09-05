import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

test("rh sidebar shows items in the curated order, with Colaboradores expandable", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request);
  await page.goto("/");

  const labels = await page.locator("aside").getByRole("link").allTextContents();

  expect(labels).toEqual([
    "Colaboradores",
    "Plantão",
    "Aprovações",
    "Documentos",
    "Pagamentos",
    "Onboarding",
    "Notificações",
    "Mural",
  ]);

  await page.getByRole("button", { name: "Expandir Colaboradores" }).click();

  await expect(page.getByRole("link", { name: "Ponto", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Banco de Horas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Holerites" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Benefícios" })).toBeVisible();

  await page.getByRole("link", { name: "Colaboradores", exact: true }).click();
  await expect(page).toHaveURL(/\/colaboradores$/);
});

test("gestor sidebar shows items in the curated order, with Colaboradores expandable", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request);
  await page.goto("/");

  const labels = await page.locator("aside").getByRole("link").allTextContents();

  expect(labels).toEqual([
    "Colaboradores",
    "Plantão",
    "Aprovações",
    "Documentos",
    "Onboarding",
    "Horas",
    "Notificações",
    "Mural",
    "Gestão de Carreiras",
  ]);

  await page.getByRole("button", { name: "Expandir Colaboradores" }).click();

  await expect(page.getByRole("link", { name: "Ponto", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Banco de Horas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Holerites" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Benefícios" })).toBeVisible();

  await page.getByRole("link", { name: "Colaboradores", exact: true }).click();
  await expect(page).toHaveURL(/\/colaboradores$/);
});

test("sidebar renders both sections and navigates between them", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request);
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Colaboradores", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Plantão" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Aprovações" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Documentos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mural" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Onboarding" })).toBeVisible();

  // Ponto, Banco de Horas, Holerites and Benefícios live inside the
  // collapsed Colaboradores group — see the dedicated ordering test below.
  await expect(page.getByRole("link", { name: "Ponto", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Banco de Horas" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Holerites" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Benefícios" })).toHaveCount(0);

  // rh-only and colaborador-only items don't show up for gestor; Convenções,
  // Alertas and Operacional were removed entirely — nobody has access anymore.
  await expect(page.getByRole("link", { name: "Convenções" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Alertas" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Operacional" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Histórico de Pontos" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Folha de Ponto" })).toHaveCount(0);

  await page.getByRole("link", { name: "Aprovações" }).click();
  await expect(page).toHaveURL(/\/aprovacoes$/);
  await expect(page.getByRole("heading", { name: "Fila de aprovações" })).toBeVisible();

  await page.getByRole("link", { name: "Documentos" }).click();
  await expect(page).toHaveURL(/\/documentos$/);
  await expect(page.getByRole("heading", { name: "Documentos e atestados" })).toBeVisible();
});

test("colaborador sees a curated, grouped sidebar instead of the gestor/rh menu", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");

  // "Colaborador" starts collapsed — its children only show once expanded.
  await expect(page.getByRole("link", { name: "Colaborador", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Banco de Horas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Férias" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Documentos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mural" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Notificações" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Histórico de Pontos" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Folha de Ponto" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Holerites" })).toHaveCount(0);

  await expect(page.getByRole("link", { name: "Colaboradores" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Plantão" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Aprovações" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Convenções" })).toHaveCount(0);

  await page.getByRole("button", { name: "Expandir Colaborador" }).click();
  await expect(page.getByRole("link", { name: "Holerites" })).toBeVisible();
  await page.getByRole("link", { name: "Histórico de Pontos" }).click();
  await expect(page).toHaveURL(/\/historico$/);
});

test("expands and collapses the Colaborador group on click, without navigating", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Histórico de Pontos" })).toHaveCount(0);

  await page.getByRole("button", { name: "Expandir Colaborador" }).click();
  await expect(page.getByRole("link", { name: "Histórico de Pontos" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("button", { name: "Recolher Colaborador" }).click();
  await expect(page.getByRole("link", { name: "Histórico de Pontos" })).toHaveCount(0);
});

test("highlights the active nav link and only the active one", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request);
  await page.goto("/");
  await page.getByRole("button", { name: "Expandir Colaboradores" }).click();

  await expect(page.getByRole("link", { name: "Ponto", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("link", { name: "Plantão" })).not.toHaveAttribute("aria-current");

  await page.getByRole("link", { name: "Plantão" }).click();
  await expect(page).toHaveURL(/\/escala$/);

  await expect(page.getByRole("link", { name: "Plantão" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Ponto", exact: true })).not.toHaveAttribute(
    "aria-current",
  );
});

test("the user menu shows the authenticated user's name and role, and can log out", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request);
  await page.goto("/");

  await expect(page.getByText("Carla RH")).not.toBeVisible();

  await page.locator('summary[aria-label="Menu do usuário"]').click();

  await expect(page.getByText("Carla RH")).toBeVisible();
  await expect(page.getByText("RH", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("collapses the sidebar to icons-only and remembers the preference on reload", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request);
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Documentos" })).toBeVisible();
  await expect(page.getByText("Sistema de Gestão de Pessoas")).toBeVisible();

  await page.getByRole("button", { name: "Recolher menu" }).click();

  // The link still resolves by its accessible name/title (icon-only, no
  // visible label), and still navigates like a normal link.
  await expect(page.getByText("Sistema de Gestão de Pessoas")).toHaveCount(0);
  await page.getByRole("link", { name: "Documentos" }).click();
  await expect(page).toHaveURL(/\/documentos$/);

  // Preference survives a reload.
  await page.reload();
  await expect(page.getByRole("button", { name: "Expandir menu" })).toBeVisible();
  await expect(page.getByText("Sistema de Gestão de Pessoas")).toHaveCount(0);

  await page.getByRole("button", { name: "Expandir menu" }).click();
  await expect(page.getByText("Sistema de Gestão de Pessoas")).toBeVisible();
});
