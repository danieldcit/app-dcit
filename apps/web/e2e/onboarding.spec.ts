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
        fullAccessGrantedAt: null,
        fullAccessGrantSource: null,
        fullAccessGrantedByName: null,
      },
      {
        userId: "user-2",
        userName: "Elias Colaborador",
        completedCount: 2,
        totalCount: 2,
        tasks: GESTOR_VIEW_TASKS,
        completedTaskIds: ["task-1", "task-2"],
        fullAccessGrantedAt: null,
        fullAccessGrantSource: null,
        fullAccessGrantedByName: null,
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
        fullAccessGrantedAt: null,
        fullAccessGrantSource: null,
        fullAccessGrantedByName: null,
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

test("the 'Liberar acesso total ao SGP Portal' button is clickable even with pending tasks, and asks for confirmation", async ({
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
        fullAccessGrantedAt: null,
        fullAccessGrantSource: null,
        fullAccessGrantedByName: null,
      },
    ],
  });
  await seedResponse(request, {
    method: "POST",
    path: "/onboarding/equipe/user-1/liberar-acesso",
    response: { grantedAt: "2026-09-07T12:00:00.000Z", source: "manual", grantedByName: "Bruno Gestor" },
  });

  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Diana Colaboradora/ }).click();

  const grantButton = page.getByRole("button", { name: "Liberar acesso total ao SGP Portal" });
  await expect(grantButton).toBeEnabled();
  await grantButton.click();

  await expect(page.getByText(/ainda não completou o onboarding/)).toBeVisible();
  await page.getByRole("button", { name: "Confirmar liberação" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.some(
        (r) => r.method === "POST" && r.path === "/onboarding/equipe/user-1/liberar-acesso",
      );
    })
    .toBe(true);
});

test("the confirmation dialog wording reflects a colaborador who already finished everything", async ({
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
        completedCount: 2,
        totalCount: 2,
        tasks: GESTOR_VIEW_TASKS,
        completedTaskIds: ["task-1", "task-2"],
        fullAccessGrantedAt: null,
        fullAccessGrantSource: null,
        fullAccessGrantedByName: null,
      },
    ],
  });

  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Diana Colaboradora/ }).click();
  await page.getByRole("button", { name: "Liberar acesso total ao SGP Portal" }).click();

  await expect(page.getByText(/concluiu todas as etapas do onboarding/)).toBeVisible();
  await expect(page.getByText(/ainda não completou o onboarding/)).toHaveCount(0);
});

test("shows the grant origin once full access has already been granted, and the button is gone", async ({
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
        completedCount: 2,
        totalCount: 2,
        tasks: GESTOR_VIEW_TASKS,
        completedTaskIds: ["task-1", "task-2"],
        fullAccessGrantedAt: "2026-09-06T12:00:00.000Z",
        fullAccessGrantSource: "auto",
        fullAccessGrantedByName: null,
      },
    ],
  });

  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Diana Colaboradora/ }).click();

  await expect(page.getByRole("button", { name: "Acesso liberado automaticamente" })).toBeDisabled();
});

test("shows who manually granted early access", async ({ page, context, request }) => {
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
        fullAccessGrantedAt: "2026-09-06T12:00:00.000Z",
        fullAccessGrantSource: "manual",
        fullAccessGrantedByName: "Carla RH",
      },
    ],
  });

  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Diana Colaboradora/ }).click();

  await expect(page.getByRole("button", { name: "Liberado manualmente por Carla RH" })).toBeDisabled();
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

test("the Assistir ao vídeo task expands to an embedded player, not a toggle", async ({
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
      tasks: [
        {
          id: "task-3",
          title: "Assistir ao vídeo de boas-vindas",
          description: "Conheça a cultura da empresa.",
          requiresUpload: false,
          requiresVideo: true,
        },
      ],
      completedTaskIds: [],
    },
  });

  await page.goto("/onboarding");
  await expect(page.getByText("Pendente", { exact: true })).toBeVisible();
  await page.getByText("Assistir ao vídeo de boas-vindas").click();

  await expect(page.getByText("Fechar", { exact: true })).toBeVisible();

  // The embedded player talks to the real youtube.com (no fake for a
  // third-party embed in this suite) — assert only the wiring this test
  // owns: expanding never calls the toggle endpoint by itself. Completion
  // is exercised as a unit of trust in WelcomeVideoPlayer's onEnded wiring,
  // not re-verified against a real YouTube playthrough here.
  const recorded = await getRecordedRequests(request);
  expect(recorded.some((r) => r.method === "POST" && r.path === "/onboarding/tarefas/task-3/toggle")).toBe(false);
});

test("the Conhecer o time task expands to the team grid, with its own Marcar como concluído button", async ({
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
      tasks: [
        {
          id: "task-4",
          title: "Conhecer o time",
          description: "Veja quem são as pessoas com quem você vai trabalhar.",
          requiresUpload: false,
          requiresVideo: false,
          showsTeam: true,
        },
      ],
      completedTaskIds: [],
    },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/onboarding/tarefas/task-4/toggle",
    response: { completed: true },
  });

  await page.goto("/onboarding");
  await expect(page.getByText("Pendente", { exact: true })).toBeVisible();
  await page.getByText("Conhecer o time").click();

  await expect(page.getByText("Fechar", { exact: true })).toBeVisible();
  await expect(page.getByText("Founder e CEO na DCIT")).toBeVisible();
  await expect(page.getByRole("button", { name: "Marcar como concluído" })).toBeVisible();

  // Expanding is separate from completing — only clicking the button inside
  // the grid (not the row header) should call the toggle endpoint.
  let recorded = await getRecordedRequests(request);
  expect(recorded.some((r) => r.method === "POST" && r.path === "/onboarding/tarefas/task-4/toggle")).toBe(false);

  await page.getByRole("button", { name: "Marcar como concluído" }).click();
  await expect
    .poll(async () => {
      const requests = await getRecordedRequests(request);
      return requests.some((r) => r.method === "POST" && r.path === "/onboarding/tarefas/task-4/toggle");
    })
    .toBe(true);
});

test("the Assinar o contrato task expands to a download+upload box and auto-completes on submit", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myContract: { submittedAt: null } });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [
        {
          id: "task-1",
          title: "Assinar o contrato",
          description: "Revise e assine seu contrato de trabalho digitalmente.",
          requiresUpload: false,
          requiresVideo: false,
          showsTeam: false,
          requiresContract: true,
        },
      ],
      completedTaskIds: [],
    },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/documentos/contrato",
    status: 201,
    response: { submittedAt: "2026-09-07T12:00:00.000Z" },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/onboarding/tarefas/task-1/toggle",
    response: { completed: true },
  });

  await page.goto("/onboarding");
  await expect(page.getByText("Pendente", { exact: true })).toBeVisible();
  await page.getByText("Assinar o contrato").click();

  await expect(page.getByRole("link", { name: "Baixar modelo do contrato" })).toHaveAttribute(
    "href",
    "/documents/contrato-modelo.pdf",
  );

  await page.setInputFiles('input[type="file"]', {
    name: "contrato-assinado.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 fake"),
  });
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/documentos/contrato")?.body;
    })
    .toEqual({ fileDataUrl: expect.stringMatching(/^data:application\/pdf;base64,/) });

  // Uploading the signed contract must also mark the onboarding task done —
  // same auto-complete-on-action shape as the welcome video's onEnded.
  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.some((r) => r.method === "POST" && r.path === "/onboarding/tarefas/task-1/toggle");
    })
    .toBe(true);
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
  const taskItem = page.locator("li", { hasText: "Assinar o contrato" });
  await expect(taskItem.getByText("Concluído", { exact: true })).toBeVisible();
  await taskItem.click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.some((r) => r.method === "POST" && r.path === "/onboarding/tarefas/task-1/toggle");
    })
    .toBe(true);
});

test("completing the last task shows a 'wait for gestor/rh' dialog, not an unlock", async ({
  page,
  context,
  request,
}) => {
  // Reversed per explicit request: finishing every task no longer unlocks
  // anything by itself — gestor/rh must always grant access (see
  // onboarding-row.tsx), whether before or after completion.
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [] });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [{ id: "task-1", title: "Assinar o contrato", description: "Revise e assine.", requiresUpload: false }],
      completedTaskIds: [],
      completedAccessItems: [],
      fullAccessGrantedAt: null,
    },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/onboarding/tarefas/task-1/toggle",
    response: { completed: true },
  });

  await page.goto("/onboarding");
  await expect(page.getByText("Parabéns", { exact: false })).toHaveCount(0);

  // Re-seed the GET *before* clicking — same ordering reasoning as the
  // existing "after uploading a document, the task flips to Concluído"
  // test: the click's revalidatePath races an already-seeded response.
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [{ id: "task-1", title: "Assinar o contrato", description: "Revise e assine.", requiresUpload: false }],
      completedTaskIds: ["task-1"],
      completedAccessItems: [],
      fullAccessGrantedAt: null,
    },
  });

  const taskItem = page.locator("li", { hasText: "Assinar o contrato" });
  await taskItem.click();

  await expect(page.getByText("Parabéns! Onboarding concluído")).toBeVisible();
  await expect(page.getByText("Aguarde o gestor ou RH liberar seu acesso completo ao portal.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir para o Dashboard" })).toHaveCount(0);
});

test("does not show the completion dialog on a fresh load that was already complete before", async ({
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
      tasks: [{ id: "task-1", title: "Assinar o contrato", description: "Revise e assine.", requiresUpload: false }],
      completedTaskIds: ["task-1"],
      completedAccessItems: [],
      fullAccessGrantedAt: null,
    },
  });

  await page.goto("/onboarding");

  await expect(page.getByText("Parabéns", { exact: false })).toHaveCount(0);
});

test("shows an 'access unlocked' dialog when fullAccessGrantedAt transitions to set", async ({
  page,
  context,
  request,
}) => {
  // Covers both real paths this can happen: gestor/rh granting the early
  // exception before completion, or formalizing it after — either way this
  // is the one event that actually means "you're unlocked now". Uses a
  // second, still-incomplete task's own access-item toggle purely as the
  // vehicle to force a same-page refetch (a full page.reload() would
  // re-mount the component with the new value already as its initial ref,
  // never observing a transition — this must happen without unmounting).
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [] });
  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [
        { id: "task-1", title: "Assinar o contrato", description: "Revise e assine.", requiresUpload: false },
        {
          id: "task-2",
          title: "Configurar seus acessos",
          description: "E-mail, Teams...",
          requiresUpload: false,
          requiresAccessChecklist: true,
        },
      ],
      completedTaskIds: ["task-1"],
      completedAccessItems: [],
      fullAccessGrantedAt: null,
    },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/onboarding/acessos/teams/toggle",
    response: { completed: true },
  });

  await page.goto("/onboarding");
  await expect(page.getByText("Acesso liberado", { exact: false })).toHaveCount(0);

  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [
        { id: "task-1", title: "Assinar o contrato", description: "Revise e assine.", requiresUpload: false },
        {
          id: "task-2",
          title: "Configurar seus acessos",
          description: "E-mail, Teams...",
          requiresUpload: false,
          requiresAccessChecklist: true,
        },
      ],
      completedTaskIds: ["task-1"],
      completedAccessItems: ["teams"],
      fullAccessGrantedAt: "2026-09-07T12:00:00.000Z",
    },
  });

  await page.getByText("Configurar seus acessos").click();
  const taskItem = page.locator("li").filter({ has: page.getByText("Configurar seus acessos") });
  const teamsItem = taskItem.locator("li").filter({ has: page.getByText("Teams", { exact: true }) });
  await teamsItem.getByRole("button", { name: "Pendente" }).click();

  await expect(page.getByText("🎉 Acesso liberado!")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir para o Dashboard" })).toHaveAttribute("href", "/");
  // The still-incomplete track (1 of 2) must not also trigger the
  // completion-waiting dialog alongside the unlock one.
  await expect(page.getByText("Parabéns! Onboarding concluído")).toHaveCount(0);
});

test("does not show the completion dialog if access was already granted before the last task finished", async ({
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
      tasks: [{ id: "task-1", title: "Assinar o contrato", description: "Revise e assine.", requiresUpload: false }],
      completedTaskIds: [],
      completedAccessItems: [],
      fullAccessGrantedAt: "2026-09-06T12:00:00.000Z",
    },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/onboarding/tarefas/task-1/toggle",
    response: { completed: true },
  });

  await page.goto("/onboarding");

  await seedResponse(request, {
    method: "GET",
    path: "/onboarding/tarefas",
    response: {
      tasks: [{ id: "task-1", title: "Assinar o contrato", description: "Revise e assine.", requiresUpload: false }],
      completedTaskIds: ["task-1"],
      completedAccessItems: [],
      fullAccessGrantedAt: "2026-09-06T12:00:00.000Z",
    },
  });
  const taskItem = page.locator("li", { hasText: "Assinar o contrato" });
  await taskItem.click();

  await expect(page.getByText("Parabéns", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Acesso liberado", { exact: false })).toHaveCount(0);
});

test("the Configurar seus acessos task expands to 5 independently toggleable items", async ({
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
      tasks: [
        {
          id: "task-5",
          title: "Configurar seus acessos",
          description: "Configure seus acessos ao sistema.",
          requiresUpload: false,
          requiresVideo: false,
          showsTeam: false,
          requiresContract: false,
          requiresAccessChecklist: true,
        },
      ],
      completedTaskIds: [],
      completedAccessItems: [],
    },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/onboarding/acessos/teams/toggle",
    response: { completed: true },
  });

  await page.goto("/onboarding");
  await expect(page.getByText("Pendente", { exact: true })).toBeVisible();
  await page.getByText("Configurar seus acessos").click();

  await expect(page.getByText("Fechar", { exact: true })).toBeVisible();
  await expect(page.getByText("SGN Portal")).toBeVisible();
  await expect(page.getByText("Movidesk")).toBeVisible();
  await expect(page.getByText("Email corporativo")).toBeVisible();
  await expect(page.getByText("Teams")).toBeVisible();
  await expect(page.getByText("Site24x7")).toBeVisible();

  // Each item is its own toggle — clicking one must not call the overall
  // task's toggle endpoint, only the item-scoped one. Scoped to the task's
  // own <li> first, same reasoning as the "Enviar documentos" tests above:
  // the outer task <li> also "has" the text "Teams" as a nested descendant.
  const taskItem = page.locator("li").filter({ has: page.getByText("Configurar seus acessos") });
  const teamsItem = taskItem.locator("li").filter({ has: page.getByText("Teams", { exact: true }) });
  await teamsItem.getByRole("button", { name: "Pendente" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.some((r) => r.method === "POST" && r.path === "/onboarding/acessos/teams/toggle");
    })
    .toBe(true);

  const recorded = await getRecordedRequests(request);
  expect(recorded.some((r) => r.method === "POST" && r.path === "/onboarding/tarefas/task-5/toggle")).toBe(false);
});

test("a completed non-upload task shows Desfazer, and clicking it undoes the completion", async ({
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
      tasks: [{ id: "task-1", title: "Assinar o contrato", description: "Revise e assine.", requiresUpload: false }],
      completedTaskIds: ["task-1"],
    },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/onboarding/tarefas/task-1/toggle",
    response: { completed: false },
  });

  await page.goto("/onboarding");
  const taskItem = page.locator("li", { hasText: "Assinar o contrato" });
  await expect(taskItem.getByText("Desfazer", { exact: true })).toBeVisible();
  await taskItem.click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.some((r) => r.method === "POST" && r.path === "/onboarding/tarefas/task-1/toggle");
    })
    .toBe(true);
});
