import type { APIRequestContext, BrowserContext } from "@playwright/test";

// Fixture JWT for e2e tests: real header/signature aren't checked by the
// web app (proxy.ts only checks the cookie's presence; getSession() decodes
// the payload without verifying the signature — see apps/web/src/lib/session.ts
// for why that's safe: it's display-only, the API re-verifies on every call).
function fakeSessionToken(claims: { sub: string; role: string; name: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.fixture-signature`;
}

export async function addSessionCookie(
  context: BrowserContext,
  claims: { sub: string; role: string; name: string } = {
    sub: "gestor-1",
    role: "gestor",
    name: "Bruno Gestor",
  }
) {
  await context.addCookies([
    {
      name: "ponto_session",
      value: fakeSessionToken(claims),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

const FAKE_API_URL = "http://localhost:3000";

// Several (app) pages fetch server-side, in the Next.js Node process — never
// in the browser — so page/context.route() can't intercept them (that only
// catches browser-originated requests). apps/web's dev server always talks
// to a real HTTP server at API_URL, so e2e/fake-api-server.mjs *is* that
// server during tests (wired up as a second Playwright webServer). These
// helpers drive its seed/reset/requests control endpoints over Playwright's
// `request` fixture, a real HTTP client independent of the browser.
export async function mockApi(
  request: APIRequestContext,
  data: {
    atestados?: unknown[];
    vacations?: unknown[];
    adjustments?: unknown[];
    compensations?: unknown[];
    team?: unknown[];
    shifts?: unknown[];
    employees?: unknown[];
    trash?: unknown[];
    muralPosts?: unknown[];
    birthdays?: unknown[];
    balances?: unknown[];
    partners?: unknown[];
    onboardingProgress?: unknown[];
    activeSobreaviso?: unknown[];
    deslocamentos?: unknown[];
    admissionDocuments?: unknown[];
    certifications?: unknown[];
    myAdmissionDocuments?: unknown[];
    myCertifications?: unknown[];
    myAtestados?: unknown[];
    jornadaAlerts?: unknown[];
    convencoes?: unknown[];
    horasResumo?: unknown[];
    bancoDeHorasEquipe?: unknown[];
    holerites?: unknown[];
    myHolerites?: unknown[];
    bancoDeHorasMinhas?: unknown;
    myCompensations?: unknown[];
    feriasData?: unknown;
    notifications?: unknown[];
    myContract?: unknown;
    teamContracts?: unknown[];
  } = {}
) {
  await request.post(`${FAKE_API_URL}/__reset`);
  if (data.atestados) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/atestados/team", response: data.atestados },
    });
  }
  if (data.vacations) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/solicitacoes/ferias/todas", response: data.vacations },
    });
  }
  if (data.adjustments) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/solicitacoes/ajustes/todas", response: data.adjustments },
    });
  }
  if (data.compensations) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/solicitacoes/compensacoes/todas", response: data.compensations },
    });
  }
  if (data.team) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/time-entries/team", response: data.team },
    });
  }
  if (data.shifts) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/operacional/escala", response: data.shifts },
    });
  }
  if (data.employees) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/employees", response: data.employees },
    });
  }
  if (data.trash) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/employees/trash", response: data.trash },
    });
  }
  if (data.muralPosts) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/mural/posts", response: data.muralPosts },
    });
  }
  if (data.birthdays) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/mural/birthdays", response: data.birthdays },
    });
  }
  if (data.balances) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/beneficios/saldos/equipe", response: data.balances },
    });
  }
  if (data.partners) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/beneficios/parceiros", response: data.partners },
    });
  }
  if (data.onboardingProgress) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/onboarding/equipe", response: data.onboardingProgress },
    });
  }
  if (data.activeSobreaviso) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/operacional/sobreaviso/equipe", response: data.activeSobreaviso },
    });
  }
  if (data.deslocamentos) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/operacional/deslocamentos/equipe", response: data.deslocamentos },
    });
  }
  if (data.admissionDocuments) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/documentos/admissionais/equipe", response: data.admissionDocuments },
    });
  }
  if (data.certifications) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/documentos/certificacoes/equipe", response: data.certifications },
    });
  }
  if (data.myAdmissionDocuments) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/documentos/admissionais", response: data.myAdmissionDocuments },
    });
  }
  if (data.myCertifications) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/documentos/certificacoes", response: data.myCertifications },
    });
  }
  if (data.myAtestados) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/atestados/mine", response: data.myAtestados },
    });
  }
  if (data.jornadaAlerts) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/alertas", response: data.jornadaAlerts },
    });
  }
  if (data.convencoes) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/convencoes", response: data.convencoes },
    });
  }
  if (data.horasResumo) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/horas/resumo", response: data.horasResumo },
    });
  }
  if (data.bancoDeHorasEquipe) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/banco-de-horas/equipe", response: data.bancoDeHorasEquipe },
    });
  }
  if (data.holerites) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/documentos/holerites/equipe", response: data.holerites },
    });
  }
  if (data.myHolerites) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/documentos/holerites", response: data.myHolerites },
    });
  }
  if (data.bancoDeHorasMinhas) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/banco-de-horas/minhas", response: data.bancoDeHorasMinhas },
    });
  }
  if (data.myCompensations) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/solicitacoes/compensacoes", response: data.myCompensations },
    });
  }
  if (data.feriasData) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/solicitacoes/ferias", response: data.feriasData },
    });
  }
  if (data.notifications) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/notifications/mine", response: data.notifications },
    });
  }
  if (data.myContract) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/documentos/contrato", response: data.myContract },
    });
  }
  if (data.teamContracts) {
    await request.post(`${FAKE_API_URL}/__seed`, {
      data: { path: "/documentos/contrato/equipe", response: data.teamContracts },
    });
  }
}

export async function getRecordedRequests(
  request: APIRequestContext
): Promise<Array<{ method: string; path: string; query: Record<string, string>; body: unknown }>> {
  const res = await request.get(`${FAKE_API_URL}/__requests`);
  return res.json();
}

// General-purpose seeding for a specific method+path+status, used where the
// typed mockApi() helper's GET-only, always-200 seeding isn't expressive
// enough (e.g. simulating a failed PATCH, or a specific poll response).
export async function seedResponse(
  request: APIRequestContext,
  options: { method: string; path: string; status?: number; response: unknown }
) {
  await request.post(`${FAKE_API_URL}/__seed`, {
    data: {
      method: options.method,
      path: options.path,
      status: options.status ?? 200,
      response: options.response,
    },
  });
}
