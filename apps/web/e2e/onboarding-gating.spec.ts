import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

test("a restricted colaborador is redirected to /onboarding from any other route", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { onboardingUnlocked: false });

  await page.goto("/mural");

  await expect(page).toHaveURL(/\/onboarding$/);
});

test("a restricted colaborador can load /onboarding directly, no redirect loop", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { onboardingUnlocked: false, myAdmissionDocuments: [] });

  await page.goto("/onboarding");

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("Complete os passos abaixo.")).toBeVisible();
});

test("a restricted colaborador's sidebar shows only Onboarding", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { onboardingUnlocked: false, myAdmissionDocuments: [] });

  await page.goto("/onboarding");

  await expect(page.getByRole("link", { name: "Onboarding" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mural" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Documentos" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Férias" })).toHaveCount(0);
});

test("an unlocked colaborador is not redirected, and sees the full sidebar", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { onboardingUnlocked: true });

  await page.goto("/mural");

  await expect(page).toHaveURL(/\/mural$/);
  await expect(page.getByRole("link", { name: "Onboarding" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mural" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Documentos" })).toBeVisible();
});

test("gestor is never gated, regardless of onboarding status", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request, { onboardingUnlocked: false, team: [] });

  await page.goto("/");

  await expect(page).toHaveURL("http://localhost:3001/");
  await expect(page.getByRole("link", { name: "Colaboradores", exact: true })).toBeVisible();
});
