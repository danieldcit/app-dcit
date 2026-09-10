import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

test("switches the UI to English via the user menu and persists it across reload", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Banco de Horas", exact: true })).toBeVisible();

  await page.getByLabel("Menu do usuário").click();
  await page.getByRole("button", { name: "English" }).click();

  await expect(page.getByRole("link", { name: "Overtime Bank", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change password" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Help Center" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");

  await page.reload();

  await expect(page.getByRole("link", { name: "Overtime Bank", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
});

test("switches the UI to Spanish and the notification bell renders translated text", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await page.goto("/");

  await page.getByLabel("Menu do usuário").click();
  await page.getByRole("button", { name: "Español" }).click();

  await expect(page.getByRole("link", { name: "Banco de horas", exact: true })).toBeVisible();

  await page.getByLabel("Notificaciones").click();
  await expect(page.getByText("Ninguna notificación.")).toBeVisible();
});

test("switching back to Português restores the original labels", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await page.goto("/");

  await page.getByLabel("Menu do usuário").click();
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("link", { name: "Overtime Bank", exact: true })).toBeVisible();

  // The menu stays open after picking a language (only "Sair"/"Sign out"
  // closes it) — the switcher's buttons are still visible, just relabeled.
  await page.getByRole("button", { name: "Português" }).click();

  await expect(page.getByRole("link", { name: "Banco de Horas", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
});
