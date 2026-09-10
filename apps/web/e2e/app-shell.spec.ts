import { test, expect } from "@playwright/test";

import { addSessionCookie, getRecordedRequests, mockApi, seedResponse } from "./test-session";

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

  await page.getByLabel("Menu do usuário").click();

  await expect(page.getByText("Carla RH")).toBeVisible();
  await expect(page.getByText("RH", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("uploads a profile photo via the edit-photo dialog and shows it in the button and panel", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await page.goto("/");

  await page.getByLabel("Menu do usuário").click();
  await expect(page.getByLabel("Menu do usuário").locator("img")).toHaveCount(0);

  await page.getByLabel("Editar foto").click();
  await page.setInputFiles('input[type="file"]', {
    name: "foto.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("fake-image-bytes"),
  });

  await expect(page.getByLabel("Menu do usuário").locator("img")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remover foto" })).toBeVisible();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/employees/me/avatar");
    })
    .toBeTruthy();
});

test("removes a profile photo from the edit-photo dialog", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await page.goto("/");

  await page.getByLabel("Menu do usuário").click();
  await page.getByLabel("Editar foto").click();
  await page.setInputFiles('input[type="file"]', {
    name: "foto.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("fake-image-bytes"),
  });
  await expect(page.getByRole("button", { name: "Remover foto" })).toBeVisible();

  await page.getByRole("button", { name: "Remover foto" }).click();

  await expect(page.getByRole("button", { name: "Remover foto" })).toHaveCount(0);
  await expect(page.getByLabel("Menu do usuário").locator("img")).toHaveCount(0);

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "DELETE" && r.path === "/employees/me/avatar");
    })
    .toBeTruthy();
});

test("a freshly loaded user menu shows a previously saved photo, including inside the edit-photo dialog", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await seedResponse(request, {
    method: "GET",
    path: "/employees/me/avatar",
    response: { photo: "data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh" },
  });
  await page.goto("/");

  await page.getByLabel("Menu do usuário").click();
  await expect(page.getByLabel("Menu do usuário").locator("img")).toBeVisible();

  await page.getByLabel("Editar foto").click();
  await expect(page.getByRole("button", { name: "Remover foto" })).toBeVisible();
});

test("clicking outside the edit-photo dialog closes it without closing the user menu", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await page.goto("/");

  await page.getByLabel("Menu do usuário").click();
  await page.getByLabel("Editar foto").click();
  await expect(page.getByText("Editar foto")).toBeVisible();

  await page.mouse.click(10, 10);

  await expect(page.getByText("Editar foto")).not.toBeVisible();
  await expect(page.getByText("Ana", { exact: true })).toBeVisible();
});

test("changes the password successfully via the Alterar senha dialog", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await page.goto("/");

  await page.getByLabel("Menu do usuário").click();
  await page.getByRole("button", { name: "Alterar senha" }).click();

  await page.getByPlaceholder("Senha atual").fill("senha-antiga");
  await page.getByPlaceholder("Nova senha", { exact: true }).fill("senha-nova-123");
  await page.getByPlaceholder("Confirmar nova senha").fill("senha-nova-123");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();

  await expect(page.getByText("Senha alterada com sucesso.")).toBeVisible();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find((r) => r.method === "POST" && r.path === "/auth/change-password");
    })
    .toBeTruthy();
});

test("shows an inline error when the new passwords don't match", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await page.goto("/");

  await page.getByLabel("Menu do usuário").click();
  await page.getByRole("button", { name: "Alterar senha" }).click();

  await page.getByPlaceholder("Senha atual").fill("senha-antiga");
  await page.getByPlaceholder("Nova senha", { exact: true }).fill("senha-nova-123");
  await page.getByPlaceholder("Confirmar nova senha").fill("outra-senha-456");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();

  await expect(page.getByText("As senhas não coincidem.")).toBeVisible();
});

test("shows the server's error message when the current password is wrong", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await seedResponse(request, {
    method: "POST",
    path: "/auth/change-password",
    status: 401,
    response: { message: "Senha atual incorreta." },
  });
  await page.goto("/");

  await page.getByLabel("Menu do usuário").click();
  await page.getByRole("button", { name: "Alterar senha" }).click();

  await page.getByPlaceholder("Senha atual").fill("senha-errada");
  await page.getByPlaceholder("Nova senha", { exact: true }).fill("senha-nova-123");
  await page.getByPlaceholder("Confirmar nova senha").fill("senha-nova-123");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();

  await expect(page.getByText("Senha atual incorreta.")).toBeVisible();
});

test("saves personal data via the Meu Perfil dialog", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await page.goto("/");

  await page.getByLabel("Menu do usuário").click();
  await page.getByRole("button", { name: "Meu Perfil" }).click();

  await page.getByLabel("RG").fill("111222333");
  await page.getByLabel("Telefone").fill("11987654321");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText("Dados salvos com sucesso.")).toBeVisible();

  await expect
    .poll(async () => {
      const recorded = await getRecordedRequests(request);
      return recorded.find(
        (r) => r.method === "PATCH" && r.path === "/employees/me/personal-data",
      )?.body;
    })
    .toMatchObject({ rg: "111222333", phone: "11987654321" });
});

test("a freshly loaded Meu Perfil dialog shows previously saved data", async ({
  page,
  context,
  request,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await seedResponse(request, {
    method: "GET",
    path: "/employees/me/personal-data",
    response: {
      rg: "999888777",
      dataNascimento: "1990-05-20",
      estadoCivil: "casado",
      enderecoRua: "Rua Teste",
      enderecoNumero: "100",
      enderecoBairro: "Centro",
      enderecoCidade: "São Paulo",
      enderecoEstado: "SP",
      enderecoCep: "01310100",
      phone: "11987654321",
    },
  });
  await page.goto("/");

  await page.getByLabel("Menu do usuário").click();
  await page.getByRole("button", { name: "Meu Perfil" }).click();

  await expect(page.getByLabel("RG")).toHaveValue("999888777");
  await expect(page.getByLabel("Telefone")).toHaveValue("11987654321");
  await expect(page.getByLabel("Cidade")).toHaveValue("São Paulo");
});

test("autofills the address from CEP via ViaCEP on blur", async ({ page, context, request }) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await mockApi(request);
  await page.route("https://viacep.com.br/ws/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        logradouro: "Praça da Sé",
        bairro: "Sé",
        localidade: "São Paulo",
        uf: "SP",
      }),
    }),
  );
  await page.goto("/");

  await page.getByLabel("Menu do usuário").click();
  await page.getByRole("button", { name: "Meu Perfil" }).click();

  await page.getByLabel("CEP").fill("01001000");
  await page.getByLabel("CEP").blur();

  await expect(page.getByLabel("Rua")).toHaveValue("Praça da Sé");
  await expect(page.getByLabel("Bairro")).toHaveValue("Sé");
  await expect(page.getByLabel("Cidade")).toHaveValue("São Paulo");
  await expect(page.getByLabel("Estado (UF)")).toHaveValue("SP");
});

for (const claims of [
  { sub: "colaborador-1", role: "colaborador", name: "Ana" },
  { sub: "gestor-1", role: "gestor", name: "Bruno Gestor" },
  { sub: "rh-1", role: "rh", name: "Carla RH" },
] as const) {
  test(`clicking outside closes the user menu for ${claims.role}`, async ({
    page,
    context,
    request,
  }) => {
    await addSessionCookie(context, claims);
    await mockApi(request);
    await page.goto("/");

    await page.getByLabel("Menu do usuário").click();
    await expect(page.getByText(claims.name, { exact: true })).toBeVisible();

    await page.mouse.click(10, 10);

    await expect(page.getByText(claims.name, { exact: true })).not.toBeVisible();
  });

  test(`clicking outside closes the notification bell for ${claims.role}`, async ({
    page,
    context,
    request,
  }) => {
    await addSessionCookie(context, claims);
    await mockApi(request, {
      notifications: [
        {
          id: "n1",
          type: "pagamento",
          category: "salario",
          message: "Seu salário foi depositado.",
          link: null,
          createdAt: "2026-09-01T12:00:00.000Z",
          readAt: null,
        },
      ],
    });
    await page.goto("/");

    await page.getByLabel("Notificações").click();
    await expect(page.getByText("Seu salário foi depositado.")).toBeVisible();

    await page.mouse.click(10, 10);

    await expect(page.getByText("Seu salário foi depositado.")).not.toBeVisible();
  });
}

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
