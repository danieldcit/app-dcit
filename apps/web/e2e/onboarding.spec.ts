import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";

// The gestor/rh branch of OnboardingPage is unchanged by the colaborador
// upload feature (Task 2) — these two tests predate that work and are kept
// as-is to cover it. Only the old "colaborador sees a permission message"
// test was dropped: colaborador now gets the checklist below instead of
// Sem permissão, so that assertion no longer describes real behavior.
const GESTOR_VIEW_TASKS = [
  { id: "task-1", title: "Assine o contrato", description: "Assine o contrato de trabalho" },
  { id: "task-2", title: "Configure acessos", description: "Configure seus acessos ao sistema" },
];

test("shows each employee's onboarding progress for a gestor", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    onboardingProgress: [
      {
        userId: "user-1",
        userName: "Diana Colaboradora",
        completedCount: 1,
        totalCount: 2,
        tasks: GESTOR_VIEW_TASKS,
        completedTaskIds: ["task-1"],
      },
      {
        userId: "user-2",
        userName: "Elias Colaborador",
        completedCount: 2,
        totalCount: 2,
        tasks: GESTOR_VIEW_TASKS,
        completedTaskIds: ["task-1", "task-2"],
      },
    ],
  });

  await page.goto("/onboarding");

  await expect(page.getByRole("heading", { name: "Onboarding" })).toBeVisible();
  await expect(page.getByText("1 de 2 tarefas concluídas")).toBeVisible();
  await expect(page.getByText("Concluído")).toBeVisible();
});

test("clicking an employee opens the task list with done/pending status", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    onboardingProgress: [
      {
        userId: "user-1",
        userName: "Diana Colaboradora",
        completedCount: 1,
        totalCount: 2,
        tasks: GESTOR_VIEW_TASKS,
        completedTaskIds: ["task-1"],
      },
    ],
  });

  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Diana Colaboradora/ }).click();

  await expect(page.getByText("Tarefas de Diana Colaboradora")).toBeVisible();
  const doneTask = page.locator("li", { hasText: "Assine o contrato" });
  await expect(doneTask.getByText("Concluída")).toBeVisible();
  const pendingTask = page.locator("li", { hasText: "Configure acessos" });
  await expect(pendingTask.getByText("Pendente")).toBeVisible();
});

test("colaborador sees the onboarding checklist with a progress bar", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [] });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [
        { id: "task-1", title: "Assinar o contrato", description: "Revise e assine.", requiresUpload: false },
        { id: "task-2", title: "Enviar documentos", description: "RG, CPF...", requiresUpload: true },
      ],
      completedTaskIds: ["task-1"],
    },
  });

  await page.goto("/onboarding");

  await expect(page.getByText("1 de 2 concluídos")).toBeVisible();
  await expect(page.getByText("Assinar o contrato")).toBeVisible();
  await expect(page.getByText("Enviar documentos")).toBeVisible();
});

test("the Enviar documentos task shows the 5 fixed document boxes when expanded, not a toggle", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [] });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [{ id: "task-2", title: "Enviar documentos", description: "RG, CPF...", requiresUpload: true }],
      completedTaskIds: [],
    },
  });

  await page.goto("/onboarding");
  await page.getByText("Enviar documentos").click();

  await expect(page.getByText("RG", { exact: true })).toBeVisible();
  await expect(page.getByText("CPF", { exact: true })).toBeVisible();
  await expect(page.getByText("Comprovante de endereço", { exact: true })).toBeVisible();
  await expect(page.getByText("Certidão de casamento", { exact: true })).toBeVisible();
  await expect(page.getByText("Certidão de nascimento dos filhos", { exact: true })).toBeVisible();
});

test("submitting a document box from Onboarding posts to the same admissionais endpoint used by Documentos", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [] });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [{ id: "task-2", title: "Enviar documentos", description: "RG, CPF...", requiresUpload: true }],
      completedTaskIds: [],
    },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/documentos/admissionais",
    status: 201,
    response: { id: "adm-new", kind: "rg", title: "RG", status: "enviado", submittedAt: "2026-09-05T12:00:00.000Z" },
  });

  await page.goto("/onboarding");
  await page.getByText("Enviar documentos").click();
  // Scoped to the task's own <li> first: an unscoped `li.filter({ has: ... })`
  // also matches the outer task <li> (it nests all 5 document boxes, so it
  // "has" the text "RG" as a descendant too), which pulls in every box's
  // input after dedup. Narrowing to the task li's *nested* <li>s avoids that
  // ancestor/descendant overlap.
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
      return recorded.find((r) => r.method === "POST" && r.path === "/documentos/admissionais")?.body;
    })
    .toEqual({ kind: "rg", photos: [expect.stringMatching(/^data:image\/jpeg;base64,/)] });
});

test("after uploading a document, the task flips to Concluído once the server reflects it", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [] });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [{ id: "task-2", title: "Enviar documentos", description: "RG, CPF...", requiresUpload: true }],
      completedTaskIds: [],
    },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/documentos/admissionais",
    status: 201,
    response: { id: "adm-new", kind: "rg", title: "RG", status: "enviado", submittedAt: "2026-09-05T12:00:00.000Z" },
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

  // Re-seed the GET *before* triggering the submit, not after: the submit
  // click synchronously fires AdmissionDocumentBox's router.refresh() right
  // after its POST resolves, so seeding the new response only after the
  // click would race an already-in-flight (stale) refresh. Same ordering
  // documentos.spec.ts's "colaborador sees their own certifications..." test
  // uses — seed the next GET response, then perform the action that triggers
  // the refetch.
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [{ id: "task-2", title: "Enviar documentos", description: "RG, CPF...", requiresUpload: true }],
      completedTaskIds: ["task-2"],
    },
  });

  await rgBox.getByRole("button", { name: "Enviar" }).click();
  await expect(rgBox.getByText("Documento enviado com sucesso!")).toBeVisible();

  await expect(taskItem.getByText("Concluído", { exact: true })).toBeVisible();
});

test("toggling a non-upload task calls the toggle endpoint", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [] });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [{ id: "task-1", title: "Assinar o contrato", description: "Revise e assine.", requiresUpload: false }],
      completedTaskIds: [],
    },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/onboarding/tarefas/task-1/toggle",
    response: { completed: true },
  });

  await page.goto("/onboarding");
  await page.getByText("Assinar o contrato").click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.some((r) => r.method === "POST" && r.path === "/onboarding/tarefas/task-1/toggle");
    })
    .toBe(true);
});
