import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

test("is reachable for colaborador, gestor, and rh", async ({ page, context, request }) => {
  await mockApi(request);

  for (const claims of [
    { sub: "colaborador-1", role: "colaborador", name: "Ana" },
    { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" },
    { sub: "rh-1", role: "rh", name: "Carla RH" },
  ]) {
    await addSessionCookie(context, claims);
    await page.goto("/ajuda");
    await expect(page.getByRole("heading", { name: "Central de Ajuda" })).toBeVisible();
  }
});

test("shows role-neutral categories to a colaborador, hides the gestor/rh-only category", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await page.goto("/ajuda");

  await expect(page.getByRole("heading", { name: "Ponto" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Minha Conta" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Para gestores e RH" })).toHaveCount(0);
  await expect(page.getByText("O que aparece em Aprovações?")).toHaveCount(0);
});

test("shows the gestor/rh-only category to a gestor", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request);
  await page.goto("/ajuda");

  await expect(page.getByRole("heading", { name: "Para gestores e RH" })).toBeVisible();
  await expect(page.getByText("O que aparece em Aprovações?")).toBeVisible();
});

test("expands an answer on click", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await page.goto("/ajuda");

  const answer = page.getByText(/Toque em "Bater Ponto" na tela inicial/);
  await expect(answer).not.toBeVisible();

  await page.getByText("Como eu bato o ponto?").click();

  await expect(answer).toBeVisible();
});

test("navigates to /ajuda from the user menu", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await page.goto("/");

  await page.getByLabel("Menu do usuário").click();
  await page.getByRole("link", { name: "Central de Ajuda" }).click();

  await expect(page).toHaveURL(/\/ajuda$/);
  await expect(page.getByRole("heading", { name: "Central de Ajuda" })).toBeVisible();
});
