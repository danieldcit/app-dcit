import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";

test("rh sees clinical detail; gestor sees the same atestado without it", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    atestados: [
      {
        id: "at-1",
        userId: "user-carlos",
        userName: "Carlos Colaborador",
        cid: "J11",
        crm: "CRM-MG 12345",
        medico: "Dr. Teste",
        dias: 2,
        status: "aprovado",
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/documentos");
  await expect(page.getByText("Carlos Colaborador (1)", { exact: true })).toBeVisible();
  await page.getByText("Carlos Colaborador (1)", { exact: true }).click();
  await expect(page.getByText("J11")).toBeVisible();
  await expect(page.getByText("Dr. Teste")).toBeVisible();

  // Same fixture data, but as the API masks cid/crm/medico for a gestor
  // caller (not this fake server, which just echoes what's seeded) — this
  // seeds the already-masked shape a gestor would actually receive.
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request, {
    atestados: [
      {
        id: "at-1",
        userId: "user-carlos",
        userName: "Carlos Colaborador",
        cid: null,
        crm: null,
        medico: null,
        dias: 2,
        status: "aprovado",
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/documentos");
  await page.getByText("Carlos Colaborador (1)", { exact: true }).click();
  await expect(page.getByText("Carlos Colaborador", { exact: true })).toBeVisible();
  await expect(page.getByText("J11")).toHaveCount(0);
  await expect(page.getByText("Dr. Teste")).toHaveCount(0);
});

test("rh can view the atestado photo; gestor never sees the button", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    atestados: [
      {
        id: "at-1",
        userId: "user-carlos",
        userName: "Carlos Colaborador",
        cid: "J11",
        crm: "CRM-MG 12345",
        medico: "Dr. Teste",
        dias: 2,
        status: "aprovado",
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });
  await seedResponse(request, {
    method: "GET",
    path: "/atestados/at-1/photo",
    response: { photoDataUrl: "data:image/jpeg;base64,ZmFrZQ==" },
  });

  await page.goto("/documentos");
  await page.getByText("Carlos Colaborador (1)", { exact: true }).click();
  await page.getByRole("button", { name: "Ver foto" }).click();
  await expect(page.getByAltText("Foto do atestado")).toBeVisible();
  await expect(page.getByAltText("Foto do atestado")).toHaveAttribute(
    "src",
    "data:image/jpeg;base64,ZmFrZQ=="
  );

  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request, {
    atestados: [
      {
        id: "at-1",
        userId: "user-carlos",
        userName: "Carlos Colaborador",
        cid: null,
        crm: null,
        medico: null,
        dias: 2,
        status: "aprovado",
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/documentos");
  await page.getByText("Carlos Colaborador (1)", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Ver foto" })).toHaveCount(0);
});

test("gestor (not just rh) can view an admissionais photo and decide its status", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request, {
    admissionDocuments: [
      {
        id: "adm-decide-1",
        userId: "user-diana",
        userName: "Diana Colaboradora",
        kind: "rg",
        title: "RG",
        status: "em_analise",
        reviewNote: null,
        submittedAt: "2026-09-05T12:00:00.000Z",
      },
    ],
  });
  await seedResponse(request, {
    method: "GET",
    path: "/documentos/admissionais/adm-decide-1/photos",
    response: { photos: ["data:image/jpeg;base64,ZmFrZQ=="] },
  });
  await seedResponse(request, {
    method: "PATCH",
    path: "/documentos/admissionais/adm-decide-1/status",
    response: { id: "adm-decide-1", status: "aprovado" },
  });

  await page.goto("/documentos");
  await page.getByText("Diana Colaboradora (1)", { exact: true }).click();
  await page.getByRole("button", { name: "Ver foto" }).click();
  await expect(page.getByAltText("Foto 1 do documento")).toBeVisible();

  await page.getByRole("button", { name: "Aprovado", exact: true }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "PATCH" && r.path === "/documentos/admissionais/adm-decide-1/status",
      )?.body;
    })
    .toEqual({ status: "aprovado" });
});

test("reproving an admissionais document requires a justification", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    admissionDocuments: [
      {
        id: "adm-decide-2",
        userId: "user-diana",
        userName: "Diana Colaboradora",
        kind: "cpf",
        title: "CPF",
        status: "em_analise",
        reviewNote: null,
        submittedAt: "2026-09-05T12:00:00.000Z",
      },
    ],
  });
  await seedResponse(request, {
    method: "GET",
    path: "/documentos/admissionais/adm-decide-2/photos",
    response: { photos: ["data:image/jpeg;base64,ZmFrZQ=="] },
  });
  await seedResponse(request, {
    method: "PATCH",
    path: "/documentos/admissionais/adm-decide-2/status",
    response: { id: "adm-decide-2", status: "recusado" },
  });

  await page.goto("/documentos");
  await page.getByText("Diana Colaboradora (1)", { exact: true }).click();
  await page.getByRole("button", { name: "Ver foto" }).click();
  await page.getByRole("button", { name: "Reprovado", exact: true }).click();
  await page.getByLabel("Motivo da reprovação").fill("Foto ilegível.");
  await page.getByRole("button", { name: "Confirmar reprovação" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "PATCH" && r.path === "/documentos/admissionais/adm-decide-2/status",
      )?.body;
    })
    .toEqual({ status: "recusado", reviewNote: "Foto ilegível." });
});

test("lists admission documents and certifications submitted by the team", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    admissionDocuments: [
      {
        id: "adm-1",
        userId: "user-1",
        userName: "Diana Colaboradora",
        kind: "comprovante_endereco",
        title: "Comprovante de endereço",
        status: "enviado",
        submittedAt: "2026-08-20T12:00:00.000Z",
      },
    ],
    certifications: [
      {
        id: "cert-1",
        userId: "user-2",
        userName: "Elias Colaborador",
        name: "AWS Certified",
        institution: "Amazon",
        validUntil: "2028-10-10T00:00:00.000Z",
      },
    ],
  });

  await page.goto("/documentos");

  await expect(page.getByRole("heading", { name: "Documentos admissionais" })).toBeVisible();
  await expect(page.getByText("Diana Colaboradora (1)", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Certificações" })).toBeVisible();
  await expect(page.getByText("Elias Colaborador (1)", { exact: true })).toBeVisible();

  await page.getByText("Diana Colaboradora (1)", { exact: true }).click();
  await expect(page.getByText("Comprovante de endereço")).toBeVisible();

  await page.getByText("Elias Colaborador (1)", { exact: true }).click();
  await expect(page.getByText("AWS Certified")).toBeVisible();
});

test("shows a certification's UTC calendar day, not a day shifted by local timezone", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  // validUntil is a date-only value stored as UTC midnight (same reasoning
  // as banco-de-horas/page.tsx's formatMonthLabel/formatDayLabel and
  // aprovacoes/page.tsx's formatDateOnly). Without formatDate's explicit
  // timeZone: "UTC", this UTC-midnight instant would render in the server's
  // ambient timezone (America/Sao_Paulo, UTC-3) as September 30th instead
  // of October 1st — a regression the noon-UTC fixtures used elsewhere in
  // this file wouldn't catch, since noon UTC never crosses a day boundary
  // in UTC-3.
  await mockApi(request, {
    certifications: [
      {
        id: "cert-2",
        userId: "user-4",
        userName: "Gabriela Colaboradora",
        name: "PMP",
        institution: "PMI",
        validUntil: "2026-10-01T00:00:00.000Z",
      },
    ],
  });

  await page.goto("/documentos");

  await expect(page.getByText("Gabriela Colaboradora (1)", { exact: true })).toBeVisible();
  await page.getByText("Gabriela Colaboradora (1)", { exact: true }).click();
  await expect(page.getByText("válida até 01/10/2026")).toBeVisible();
  await expect(page.getByText("válida até 30/09/2026")).toHaveCount(0);
});

test("shows a proper label instead of the raw status for an admissionais document", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    admissionDocuments: [
      {
        id: "adm-2",
        userId: "user-3",
        userName: "Fábio Colaborador",
        kind: "rg",
        title: "RG",
        status: "enviado",
        submittedAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });

  await page.goto("/documentos");

  await expect(page.getByText("Fábio Colaborador (1)", { exact: true })).toBeVisible();
  await page.getByText("Fábio Colaborador (1)", { exact: true }).click();
  await expect(page.getByText("Enviado", { exact: true })).toBeVisible();
  await expect(page.getByText("enviado", { exact: true })).toHaveCount(0);
});

test("colaborador sees category tabs, with Atestados active by default", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });

  await page.goto("/documentos");

  const admissionais = page.getByRole("link", { name: "Admissionais" });
  const atestados = page.getByRole("link", { name: "Atestados" });
  const certificacoes = page.getByRole("link", { name: "Certificações" });
  const contrato = page.getByRole("link", { name: "Contrato" });
  await expect(admissionais).toBeVisible();
  await expect(atestados).toBeVisible();
  await expect(certificacoes).toBeVisible();
  await expect(contrato).toBeVisible();
  await expect(atestados).toHaveClass(/categoryTabActive/);

  await admissionais.click();
  await expect(page).toHaveURL(/categoria=admissionais/);
  await expect(admissionais).toHaveClass(/categoryTabActive/);
  await expect(atestados).not.toHaveClass(/categoryTabActive/);
});

test("colaborador sees the Contrato tab, can download the model and upload a signed one", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    myAdmissionDocuments: [],
    myCertifications: [],
    myAtestados: [],
    myContract: { submittedAt: null },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/documentos/contrato",
    status: 201,
    response: { submittedAt: "2026-09-07T12:00:00.000Z" },
  });

  await page.goto("/documentos?categoria=contrato");

  await expect(page.getByText("Nenhum contrato assinado enviado ainda.")).toBeVisible();
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
});

test("rejects a non-PDF file for the signed contract with an inline error", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    myAdmissionDocuments: [],
    myCertifications: [],
    myAtestados: [],
    myContract: { submittedAt: null },
  });

  await page.goto("/documentos?categoria=contrato");
  await page.setInputFiles('input[type="file"]', {
    name: "foto.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("fake-jpeg-bytes"),
  });

  await expect(page.getByText("Formato não suportado — envie um PDF.")).toBeVisible();
});

test("gestor/rh see who has sent a signed contract, with view/download links only when one exists", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context);
  await mockApi(request, {
    atestados: [],
    admissionDocuments: [],
    certifications: [],
    teamContracts: [
      { userId: "colab-1", userName: "Colaborador Um", submittedAt: "2026-09-07T10:09:00.000Z" },
      { userId: "colab-2", userName: "Colaborador Dois", submittedAt: null },
    ],
  });

  await page.goto("/documentos");

  await expect(page.getByText("Colaborador Um")).toBeVisible();
  await expect(page.getByText("Colaborador Dois")).toBeVisible();
  await expect(page.getByText("Nenhum contrato assinado enviado ainda.")).toBeVisible();

  const row = page.locator("li").filter({ has: page.getByText("Colaborador Um") });
  await expect(row.getByRole("link", { name: "Visualizar" })).toHaveAttribute(
    "href",
    "/api/documentos/contrato/colab-1/arquivo?inline=1",
  );
  await expect(row.getByRole("link", { name: "Baixar" })).toHaveAttribute(
    "href",
    "/api/documentos/contrato/colab-1/arquivo",
  );
  const otherRow = page.locator("li").filter({ has: page.getByText("Colaborador Dois") });
  await expect(otherRow.getByRole("link", { name: "Visualizar" })).toHaveCount(0);
  await expect(otherRow.getByRole("link", { name: "Baixar" })).toHaveCount(0);
});

test("colaborador sees the 5 fixed document boxes and can submit one with a photo", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    myAdmissionDocuments: [
      {
        id: "adm-1",
        kind: "comprovante_endereco",
        title: "Comprovante de endereço",
        status: "enviado",
        reviewNote: null,
        submittedAt: "2026-08-20T12:00:00.000Z",
      },
    ],
    myCertifications: [],
    myAtestados: [],
  });
  await seedResponse(request, {
    method: "POST",
    path: "/documentos/admissionais",
    status: 201,
    response: { id: "adm-new", kind: "rg", title: "RG", status: "enviado", submittedAt: "2026-08-31T12:00:00.000Z" },
  });

  await page.goto("/documentos?categoria=admissionais");

  // All 5 fixed boxes render, regardless of which ones already have a submission.
  for (const label of ["RG", "CPF", "Comprovante de endereço", "Certidão de casamento", "Certidão de nascimento dos filhos"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  const comprovanteBox = page.locator("li").filter({ has: page.getByText("Comprovante de endereço", { exact: true }) });
  await expect(comprovanteBox.getByText("Enviado", { exact: true })).toBeVisible();
  await expect(comprovanteBox.getByRole("button", { name: "Reenviar" })).toBeVisible();

  const rgBox = page.locator("li").filter({ has: page.getByText("RG", { exact: true }) });
  await expect(rgBox.getByRole("button", { name: "Enviar" })).toBeVisible();
  await rgBox.locator('input[type="file"]').first().setInputFiles({
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

  await expect(rgBox.getByText("Documento enviado com sucesso!")).toBeVisible();
});

test("submitting a box with 2 photos sends both in the photos array", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });
  await seedResponse(request, {
    method: "POST",
    path: "/documentos/admissionais",
    status: 201,
    response: { id: "adm-photo", kind: "cpf", title: "CPF", status: "enviado", submittedAt: "2026-08-31T12:00:00.000Z" },
  });

  await page.goto("/documentos?categoria=admissionais");

  const cpfBox = page.locator("li").filter({ has: page.getByText("CPF", { exact: true }) });
  await cpfBox.locator('input[type="file"]').setInputFiles([
    { name: "cpf-front.jpg", mimeType: "image/jpeg", buffer: Buffer.from("fake-jpeg-bytes-front") },
    { name: "cpf-back.jpg", mimeType: "image/jpeg", buffer: Buffer.from("fake-jpeg-bytes-back") },
  ]);
  await cpfBox.getByRole("button", { name: "Enviar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/documentos/admissionais")?.body;
    })
    .toEqual({
      kind: "cpf",
      photos: [
        expect.stringMatching(/^data:image\/jpeg;base64,/),
        expect.stringMatching(/^data:image\/jpeg;base64,/),
      ],
    });
});

test("blocks submitting a document box without a photo", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });

  await page.goto("/documentos?categoria=admissionais");

  const rgBox = page.locator("li").filter({ has: page.getByText("RG", { exact: true }) });
  await rgBox.getByRole("button", { name: "Enviar" }).click();

  // Native "required" validation on the first photo slot blocks the submit
  // synchronously — no request is ever dispatched, so there's no async
  // race to poll for.
  const recorded = await getRecordedRequests(request);
  expect(recorded.some((r) => r.method === "POST" && r.path === "/documentos/admissionais")).toBe(
    false,
  );
});

test("shows every fixed document box as not-yet-sent when the colaborador has no submissions", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });

  await page.goto("/documentos?categoria=admissionais");

  await expect(page.getByText("Nenhum documento enviado ainda.")).toHaveCount(5);
});

test("rejects an unsupported file type with an inline error", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });

  await page.goto("/documentos?categoria=admissionais");

  const rgBox = page.locator("li").filter({ has: page.getByText("RG", { exact: true }) });
  await rgBox.locator('input[type="file"]').first().setInputFiles({
    name: "doc.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });

  await expect(
    rgBox.getByText("Formato não suportado — use JPEG, PNG ou WEBP.")
  ).toBeVisible();
});

test("colaborador sees their own certifications and can submit a new one", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    myAdmissionDocuments: [],
    myCertifications: [
      { id: "cert-1", name: "AWS Certified", institution: "Amazon", validUntil: "2028-10-10T00:00:00.000Z" },
    ],
    myAtestados: [],
  });
  await seedResponse(request, {
    method: "POST",
    path: "/documentos/certificacoes",
    status: 201,
    response: { id: "cert-new", name: "Scrum Master", institution: "Scrum.org", validUntil: "2027-05-01T00:00:00.000Z" },
  });

  await page.goto("/documentos?categoria=certificacoes");

  await expect(page.getByText("AWS Certified")).toBeVisible();
  await expect(page.getByText("Amazon · válida até 10/10/2028")).toBeVisible();

  await seedResponse(request, {
    method: "GET",
    path: "/documentos/certificacoes",
    response: [
      { id: "cert-new", name: "Scrum Master", institution: "Scrum.org", validUntil: "2027-05-01T00:00:00.000Z" },
      { id: "cert-1", name: "AWS Certified", institution: "Amazon", validUntil: "2028-10-10T00:00:00.000Z" },
    ],
  });

  await page.getByLabel("Nome").fill("Scrum Master");
  await page.getByLabel("Instituição").fill("Scrum.org");
  await page.getByLabel("Válida até (DD/MM/AAAA)").fill("01/05/2027");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/documentos/certificacoes")?.body;
    })
    .toEqual({ name: "Scrum Master", institution: "Scrum.org", validUntil: "01/05/2027" });

  await expect(page.getByText("Scrum Master")).toBeVisible();
});

test("shows a message when there are no certifications yet", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });

  await page.goto("/documentos?categoria=certificacoes");

  await expect(page.getByText("Nenhuma certificação cadastrada ainda.")).toBeVisible();
});

test("colaborador sees their own atestados and can submit one manually, with a photo", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, {
    myAdmissionDocuments: [],
    myCertifications: [],
    myAtestados: [
      {
        id: "at-1",
        cid: "J11",
        crm: "CRM-MG 12345",
        medico: "Dr. Teste",
        dias: 2,
        status: "recusado",
        reviewNote: "Faltou assinatura do médico.",
        createdAt: "2026-08-20T12:00:00.000Z",
      },
    ],
  });
  await seedResponse(request, {
    method: "POST",
    path: "/atestados",
    status: 201,
    response: { id: "at-new", cid: "A01", crm: "CRM-SP 999", medico: "Dra. Nova", dias: 3, status: "enviado", reviewNote: null, createdAt: "2026-08-31T12:00:00.000Z" },
  });

  await page.goto("/documentos?categoria=atestados");

  await expect(page.getByText("2 dia(s)")).toBeVisible();
  await expect(page.getByText("Reprovado")).toBeVisible();
  await expect(page.getByText("Faltou assinatura do médico.")).toBeVisible();

  await seedResponse(request, {
    method: "GET",
    path: "/atestados/mine",
    response: [
      { id: "at-new", cid: "A01", crm: "CRM-SP 999", medico: "Dra. Nova", dias: 3, status: "enviado", reviewNote: null, createdAt: "2026-08-31T12:00:00.000Z" },
      { id: "at-1", cid: "J11", crm: "CRM-MG 12345", medico: "Dr. Teste", dias: 2, status: "recusado", reviewNote: "Faltou assinatura do médico.", createdAt: "2026-08-20T12:00:00.000Z" },
    ],
  });

  await page.getByLabel("CID").fill("A01");
  await page.getByLabel("CRM do médico").fill("CRM-SP 999");
  await page.getByLabel("Nome do médico").fill("Dra. Nova");
  await page.getByLabel("Quantidade de dias").fill("3");
  await page.locator('input[type="file"]').setInputFiles({
    name: "atestado.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("fake-jpeg-bytes"),
  });
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/atestados")?.body;
    })
    .toEqual({
      cid: "A01",
      crm: "CRM-SP 999",
      medico: "Dra. Nova",
      dias: 3,
      photoDataUrl: expect.stringMatching(/^data:image\/jpeg;base64,/),
    });

  await expect(page.getByText("3 dia(s)")).toBeVisible();
});

test("blocks submitting the atestado form without a photo", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });

  await page.goto("/documentos?categoria=atestados");

  await page.getByLabel("CID").fill("A01");
  await page.getByLabel("CRM do médico").fill("CRM-SP 999");
  await page.getByLabel("Nome do médico").fill("Dra. Nova");
  await page.getByLabel("Quantidade de dias").fill("3");
  await page.getByRole("button", { name: "Enviar" }).click();

  const recorded = await getRecordedRequests(request);
  expect(recorded.some((r) => r.method === "POST" && r.path === "/atestados")).toBe(false);
});

test("shows a message when there are no atestados yet", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });

  await page.goto("/documentos?categoria=atestados");

  await expect(page.getByText("Nenhum atestado enviado ainda.")).toBeVisible();
});

test("picking a photo runs OCR and pre-fills CID/CRM/médico/dias, which stay editable", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });
  await seedResponse(request, {
    method: "POST",
    path: "/atestados/ocr",
    response: { cid: "B34", crm: "CRM-RJ 111", medico: "Dr. OCR", dias: 5 },
  });
  await seedResponse(request, {
    method: "POST",
    path: "/atestados",
    status: 201,
    response: { id: "at-ocr", cid: "B34", crm: "CRM-RJ 111", medico: "Editado", dias: 5, status: "enviado", reviewNote: null, createdAt: "2026-08-31T12:00:00.000Z" },
  });

  await page.goto("/documentos?categoria=atestados");

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "atestado.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("fake-jpeg-bytes"),
  });

  await expect(page.getByText("Dados preenchidos automaticamente — confira antes de enviar.")).toBeVisible();
  await expect(page.getByLabel("CID")).toHaveValue("B34");
  await expect(page.getByLabel("CRM do médico")).toHaveValue("CRM-RJ 111");
  await expect(page.getByLabel("Nome do médico")).toHaveValue("Dr. OCR");
  await expect(page.getByLabel("Quantidade de dias")).toHaveValue("5");

  // OCR-filled fields stay editable — prove it by changing one before submit.
  await page.getByLabel("Nome do médico").fill("Editado");
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/atestados")?.body;
    })
    .toEqual({
      cid: "B34",
      crm: "CRM-RJ 111",
      medico: "Editado",
      dias: 5,
      photoDataUrl: expect.stringMatching(/^data:image\/jpeg;base64,/),
    });
});

test("shows a manual-entry message when OCR can't read the photo", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request, { myAdmissionDocuments: [], myCertifications: [], myAtestados: [] });
  await seedResponse(request, {
    method: "POST",
    path: "/atestados/ocr",
    status: 500,
    response: {},
  });

  await page.goto("/documentos?categoria=atestados");

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "atestado.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("fake-jpeg-bytes"),
  });

  await expect(
    page.getByText("Não foi possível ler automaticamente — preencha os dados abaixo manualmente."),
  ).toBeVisible();
  await expect(page.getByLabel("CID")).toHaveValue("");
});
