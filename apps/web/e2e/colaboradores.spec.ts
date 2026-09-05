import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";

test("colaborador sees a permission message instead of the roster", async ({ page, context }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/colaboradores");

  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("gestor sees the roster like rh does", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" });
  await mockApi(request, {
    employees: [{ userId: "colaborador-1", name: "Ana Colaboradora", expectedStartTime: "09:00" }],
  });

  await page.goto("/colaboradores");

  await expect(page.getByText("Ana Colaboradora", { exact: true })).toBeVisible();
});

test("rh sees the roster with the current expected start time prefilled", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "colaborador-1", name: "Ana Colaboradora", expectedStartTime: "09:00" }],
  });

  await page.goto("/colaboradores");

  await expect(page.getByText("Ana Colaboradora", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Horário esperado de entrada de Ana Colaboradora")
  ).toHaveValue("09:00");
});

test("saving a valid schedule calls the API with the new time", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "colaborador-1", name: "Ana Colaboradora", expectedStartTime: null }],
  });

  await page.goto("/colaboradores");
  await page.getByLabel("Horário esperado de entrada de Ana Colaboradora").fill("08:30");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "PATCH" && r.path === "/employees/colaborador-1")
        ?.body;
    })
    .toEqual({ expectedStartTime: "08:30" });
});

test("clearing the schedule calls the API with null", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "colaborador-1", name: "Ana Colaboradora", expectedStartTime: "09:00" }],
  });

  await page.goto("/colaboradores");
  await page.getByLabel("Horário esperado de entrada de Ana Colaboradora").fill("");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "PATCH" && r.path === "/employees/colaborador-1")
        ?.body;
    })
    .toEqual({ expectedStartTime: null });
});

test("a failed save shows an inline error instead of crashing the page", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "colaborador-1", name: "Ana Colaboradora", expectedStartTime: "09:00" }],
  });
  await seedResponse(request, {
    method: "PATCH",
    path: "/employees/colaborador-1",
    status: 500,
    response: { message: "Internal server error" },
  });

  await page.goto("/colaboradores");
  await page.getByLabel("Horário esperado de entrada de Ana Colaboradora").fill("08:30");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText("Não foi possível salvar (código 500).")).toBeVisible();
});

test("the add-colaborador button is visible even with an empty roster", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, { employees: [] });

  await page.goto("/colaboradores");

  await expect(page.getByText("Nenhum colaborador cadastrado ainda.")).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Novo colaborador" })).toBeVisible();
});

test("opens the dialog and creates a new colaborador with the API", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, { employees: [] });

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "+ Novo colaborador" }).click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Nome").fill("Fabio Novo");
  await page.getByLabel("Data de admissão").fill("2026-03-01");
  await page.getByLabel("CPF").fill("98765432100");
  await page.getByLabel("Estado civil").selectOption("solteiro");
  await page.getByLabel("Estado (UF)").selectOption("RJ");
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/employees")?.body;
    })
    .toEqual({
      name: "Fabio Novo",
      role: "colaborador",
      email: null,
      cargo: null,
      nivel: null,
      convencaoId: null,
      salarioMensal: null,
      hireDate: "2026-03-01",
      cpf: "98765432100",
      rg: null,
      dataNascimento: null,
      estadoCivil: "solteiro",
      enderecoRua: null,
      enderecoNumero: null,
      enderecoBairro: null,
      enderecoCidade: null,
      enderecoEstado: "RJ",
      enderecoCep: null,
      team: null,
    });
});

test("Convenção coletiva is not offered when creating a colaborador (only when editing)", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [],
    convencoes: [{ id: "conv-1", nome: "Convenção Metalúrgicos" }],
  });

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "+ Novo colaborador" }).click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Convenção coletiva")).toHaveCount(0);
});

test("selecting a convenção and a nível in the edit dialog includes the convenção and the nível-driven salário in the payload", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [
      {
        userId: "colaborador-1",
        name: "Helena Convenio",
        role: "colaborador",
        hireDate: "2026-04-01T00:00:00.000Z",
        expectedStartTime: null,
        cpf: null,
        rg: null,
        dataNascimento: null,
        estadoCivil: null,
        enderecoRua: null,
        enderecoNumero: null,
        enderecoBairro: null,
        enderecoCidade: null,
        enderecoEstado: null,
        enderecoCep: null,
      },
    ],
    convencoes: [{ id: "conv-1", nome: "Convenção Metalúrgicos" }],
  });

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "Editar" }).click();

  await page.getByRole("dialog").getByLabel("Convenção coletiva").selectOption("conv-1");
  // Pleno 3 -> the fixed ladder's 3rd degrau (see CAREER_LADDER.pleno.degraus in
  // packages/shared-types/src/career-ladder.ts): 4000, 4700, 5500, 6200.
  await page.getByRole("dialog").getByLabel("Nível").selectOption("pleno-2");
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "PATCH" && r.path === "/employees/colaborador-1/personal-data"
      )?.body;
    })
    .toEqual({
      name: "Helena Convenio",
      role: "colaborador",
      email: null,
      cargo: null,
      nivel: "pleno",
      convencaoId: "conv-1",
      salarioMensal: "5500",
      hireDate: "2026-04-01",
      cpf: null,
      rg: null,
      dataNascimento: null,
      estadoCivil: null,
      enderecoRua: null,
      enderecoNumero: null,
      enderecoBairro: null,
      enderecoCidade: null,
      enderecoEstado: null,
      enderecoCep: null,
      team: null,
    });
});

test("a duplicate CPF shows an inline error without closing the dialog", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, { employees: [] });
  await seedResponse(request, {
    method: "POST",
    path: "/employees",
    status: 409,
    response: { message: "Já existe um colaborador cadastrado com esse CPF." },
  });

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "+ Novo colaborador" }).click();
  await page.getByLabel("Nome").fill("Duplicado");
  await page.getByLabel("Data de admissão").fill("2026-03-01");
  await page.getByLabel("CPF").fill("11111111111");
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect(
    page.getByText("Já existe um colaborador cadastrado com esse CPF.")
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("shows the four suggested teams and still accepts free text", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, { employees: [] });

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "+ Novo colaborador" }).click();

  const teamInput = page.getByLabel("Time");
  const listId = await teamInput.getAttribute("list");
  expect(listId).toBeTruthy();

  const options = await page.locator(`#${listId} option`).allTextContents();
  expect(options).toEqual(["SG MONITOR", "SGN 360", "SGM365", "SGP PORTAL"]);

  await teamInput.fill("Um Time Qualquer Digitado");
  await expect(teamInput).toHaveValue("Um Time Qualquer Digitado");
});

test("filling a CEP autofills the address from ViaCEP", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, { employees: [] });

  await page.route("https://viacep.com.br/ws/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        logradouro: "Rua das Flores",
        bairro: "Centro",
        localidade: "São Paulo",
        uf: "SP",
      }),
    })
  );

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "+ Novo colaborador" }).click();
  await page.getByLabel("CEP").fill("01310100");
  await page.getByLabel("CEP").blur();

  await expect(page.getByLabel("Rua")).toHaveValue("Rua das Flores");
  await expect(page.getByLabel("Bairro")).toHaveValue("Centro");
  await expect(page.getByLabel("Cidade")).toHaveValue("São Paulo");
  await expect(page.getByLabel("Estado (UF)")).toHaveValue("SP");
});

test("a CEP not found by ViaCEP leaves the address fields unchanged", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, { employees: [] });

  await page.route("https://viacep.com.br/ws/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ erro: true }),
    })
  );

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "+ Novo colaborador" }).click();
  await page.getByLabel("Rua").fill("Endereço Manual");
  await page.getByLabel("CEP").fill("00000000");
  await page.getByLabel("CEP").blur();

  await expect(page.getByLabel("Rua")).toHaveValue("Endereço Manual");
});

test("clicking Excluir opens a confirmation dialog, and confirming soft-deletes the employee", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "colaborador-1", name: "Ana Colaboradora", expectedStartTime: null }],
  });

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "Excluir", exact: true }).click();

  await expect(page.getByText("Excluir Ana Colaboradora?")).toBeVisible();

  await page.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "DELETE" && r.path === "/employees/colaborador-1"
      );
    })
    .toBeTruthy();
});

test("canceling the delete confirmation does not call the API", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [{ userId: "colaborador-1", name: "Ana Colaboradora", expectedStartTime: null }],
  });

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();

  const recorded = await getRecordedRequests(request);
  expect(recorded.find((r) => r.method === "DELETE")).toBeUndefined();
});

test("the lixeira section lists trashed employees and can restore one without confirmation", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [],
    trash: [
      { userId: "colaborador-2", name: "Beto Excluido", deletedAt: "2026-08-20T00:00:00.000Z" },
    ],
  });

  await page.goto("/colaboradores");
  await page.getByText("Lixeira (1)").click();
  await expect(page.getByText("Beto Excluido", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Restaurar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "PATCH" && r.path === "/employees/colaborador-2/restore"
      );
    })
    .toBeTruthy();
});

test("excluir permanentemente requires confirmation before calling the API", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [],
    trash: [
      { userId: "colaborador-2", name: "Beto Excluido", deletedAt: "2026-08-20T00:00:00.000Z" },
    ],
  });

  await page.goto("/colaboradores");
  await page.getByText("Lixeira (1)").click();
  await page.getByRole("button", { name: "Excluir permanentemente", exact: true }).click();

  await expect(page.getByText("Excluir Beto Excluido permanentemente?")).toBeVisible();

  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Excluir permanentemente" })
    .click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "DELETE" && r.path === "/employees/colaborador-2/permanent"
      );
    })
    .toBeTruthy();
});

test("opens the edit dialog prefilled and saves personal data", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, {
    employees: [
      {
        userId: "colaborador-1",
        name: "Ana Colaboradora",
        role: "colaborador",
        hireDate: "2024-01-01T00:00:00.000Z",
        expectedStartTime: null,
        cpf: "12345678901",
        rg: null,
        dataNascimento: null,
        estadoCivil: null,
        enderecoRua: null,
        enderecoNumero: null,
        enderecoBairro: null,
        enderecoCidade: null,
        enderecoEstado: null,
        enderecoCep: null,
      },
    ],
  });

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "Editar" }).click();

  await expect(page.getByRole("dialog").getByLabel("Nome")).toHaveValue("Ana Colaboradora");
  await expect(page.getByRole("dialog").getByLabel("CPF")).toHaveValue("12345678901");

  await page.getByRole("dialog").getByLabel("Nome").fill("Ana Editada");
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "PATCH" && r.path === "/employees/colaborador-1/personal-data"
      )?.body;
    })
    .toEqual({
      name: "Ana Editada",
      role: "colaborador",
      email: null,
      cargo: null,
      nivel: null,
      convencaoId: null,
      salarioMensal: null,
      hireDate: "2024-01-01",
      cpf: "12345678901",
      rg: null,
      dataNascimento: null,
      estadoCivil: null,
      enderecoRua: null,
      enderecoNumero: null,
      enderecoBairro: null,
      enderecoCidade: null,
      enderecoEstado: null,
      enderecoCep: null,
      team: null,
    });
});

test("fills and submits the Time field in the create payload", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla RH" });
  await mockApi(request, { employees: [] });

  await page.goto("/colaboradores");
  await page.getByRole("button", { name: "+ Novo colaborador" }).click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Nome").fill("Igor Time");
  await page.getByLabel("Data de admissão").fill("2026-05-01");
  await page.getByLabel("Time").fill("SGN360");
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      const body = recorded.find((r) => r.method === "POST" && r.path === "/employees")?.body as
        | { team?: string }
        | undefined;
      return body?.team;
    })
    .toBe("SGN360");
});
