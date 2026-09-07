import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";

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

test("a restricted colaborador's onboarding document upload is not redirected away by the gate", async ({
  page,
  context,
  request,
}) => {
  // Regression test: the onboarding page's embedded "Enviar documentos" box
  // calls POST /api/documentos/admissionais directly via fetch() (a Next.js
  // Route Handler, not a Server Action — a real photo's base64 breaks
  // React's Flight serialization). Before the fix, the gate redirected that
  // fetch to /onboarding for a restricted colaborador; the browser silently
  // followed the redirect and got a 200 (the onboarding page's own HTML),
  // which the client code read as success even though nothing was ever
  // saved. Asserting the request actually reaches the fake API server is
  // what catches that; a bare UI-success-message check would not.
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { onboardingUnlocked: false, myAdmissionDocuments: [] });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [{ id: "task-2", title: "Enviar documentos", description: "RG, CPF...", requiresUpload: true }],
      completedTaskIds: [],
      completedAccessItems: [],
      fullAccessGrantedAt: null,
    },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/documentos/admissionais",
    status: 201,
    response: { id: "adm-new", kind: "rg", title: "RG", status: "enviado", submittedAt: "2026-09-07T12:00:00.000Z" },
  });

  await page.goto("/onboarding");
  await page.getByText("Enviar documentos").click();

  const taskItem = page.locator("li").filter({ has: page.getByText("Enviar documentos") });
  const rgBox = taskItem.locator("li").filter({ has: page.getByText("RG", { exact: true }) });
  await rgBox.locator('input[type="file"]').setInputFiles({
    name: "rg.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("fake-jpeg-bytes"),
  });
  await rgBox.getByRole("button", { name: "Enviar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.some((r) => r.method === "POST" && r.path === "/documentos/admissionais");
    })
    .toBe(true);
  await expect(rgBox.getByText("Documento enviado com sucesso!")).toBeVisible();
});

test("gestor is never gated, regardless of onboarding status", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request, { onboardingUnlocked: false, team: [] });

  await page.goto("/");

  await expect(page).toHaveURL("http://localhost:3001/");
  await expect(page.getByRole("link", { name: "Colaboradores", exact: true })).toBeVisible();
});
