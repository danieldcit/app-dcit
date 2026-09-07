import { test, expect } from "@playwright/test";

import { addSessionCookie, mockApi } from "./test-session";

test("colaborador and rh do not see Horas in the sidebar and cannot access /horas directly", async ({
  page,
  context,
}) => {
  await addSessionCookie(context, { sub: "colaborador-1", role: "colaborador", name: "Ana" });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Horas", exact: true })).toHaveCount(0);
  await page.goto("/horas");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();

  await addSessionCookie(context, { sub: "rh-1", role: "rh", name: "Carla" });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Horas", exact: true })).toHaveCount(0);
  await page.goto("/horas");
  await expect(page.getByRole("heading", { name: "Sem permissão" })).toBeVisible();
});

test("gestor sees Horas in the sidebar and the page loads with period tabs", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request, {
    employees: [{ userId: "colab-1", name: "Colaborador Um" }],
    horasResumo: [{ userId: "colab-1", name: "Colaborador Um", horasTrabalhadas: 0, horasExtras: 0, horasTickets: 0 }],
  });

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Horas", exact: true })).toBeVisible();

  await page.goto("/horas");
  await expect(page.getByRole("heading", { name: "Horas", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mês" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Semana" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dia" })).toBeVisible();
});

test("switching period tabs navigates with the periodo query param", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request, { employees: [], horasResumo: [] });

  await page.goto("/horas");
  await page.getByRole("link", { name: "Semana" }).click();
  await expect(page).toHaveURL(/periodo=semana/);
  await page.getByRole("link", { name: "Dia" }).click();
  await expect(page).toHaveURL(/periodo=dia/);
});

test("gestor lança horas for a colaborador and sees it in the history list", async ({ page, context, request }) => {
  await addSessionCookie(context);
  await mockApi(request, {
    employees: [{ userId: "colab-1", name: "Colaborador Um" }],
    horasResumo: [{ userId: "colab-1", name: "Colaborador Um", horasTrabalhadas: 0, horasExtras: 0, horasTickets: 0 }],
  });

  await page.goto("/horas");
  await page.locator('select[name="userId"]').selectOption("colab-1");
  await page.locator('input[name="horasTickets"]').fill("6");
  await page.getByRole("button", { name: "Lançar" }).click();

  // After the Server Action's revalidatePath, re-seed /horas (list) so the
  // history section — which the gestor is about to open — has something to
  // show; the fake server is stateless (POST /horas just echoes the body,
  // it doesn't feed back into GET /horas).
  await mockApi(request, {
    employees: [{ userId: "colab-1", name: "Colaborador Um" }],
    horasResumo: [{ userId: "colab-1", name: "Colaborador Um", horasTrabalhadas: 8, horasExtras: 0, horasTickets: 6 }],
  });
  await request.post("http://localhost:3000/__seed", {
    data: {
      path: "/horas",
      response: [
        { date: "2026-09-03", horasTrabalhadas: 8, horasExtras: 0, horasTickets: 6, ticketEntryId: "entry-1" },
      ],
    },
  });

  await page.goto("/horas");
  await page.locator('select[name="colaborador"]').selectOption("colab-1");
  await expect(page.getByText("8h trabalhadas · 6h em tickets")).toBeVisible();
  await expect(page.getByRole("button", { name: "Excluir" })).toBeVisible();
});
