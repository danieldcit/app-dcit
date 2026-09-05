// A minimal stand-in for apps/api, used only by the Playwright e2e suite.
// The real reason this exists: apps/web's data fetching for pages like
// /aprovacoes runs server-side (in the Next.js Node process), never in the
// browser — so Playwright's page/context.route() (which only intercepts
// browser-originated requests) can't mock it. Running a real HTTP server on
// the port the Next app calls is the only thing that actually intercepts
// those calls. Tests seed/reset it over a small control API (__seed,
// __requests, __reset) via Playwright's `request` fixture.
import http from "node:http";

const PORT = process.env.PORT || 3000;

let seeded = {};
let recordedRequests = [];

function seedKey(method, path) {
  return `${method} ${path}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const body = await readBody(req).catch(() => undefined);

  if (req.method === "POST" && url.pathname === "/__seed") {
    const method = body.method ?? "GET";
    seeded[seedKey(method, body.path)] = {
      response: body.response,
      status: body.status ?? 200,
    };
    return sendJson(res, 204, null);
  }

  if (req.method === "POST" && url.pathname === "/__reset") {
    seeded = {};
    recordedRequests = [];
    return sendJson(res, 204, null);
  }

  if (req.method === "GET" && url.pathname === "/__requests") {
    return sendJson(res, 200, recordedRequests);
  }

  recordedRequests.push({
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    body,
  });

  const seedEntry = seeded[seedKey(req.method, url.pathname)];
  if (seedEntry) {
    return sendJson(res, seedEntry.status, seedEntry.response);
  }
  if (req.method === "GET" && url.pathname === "/atestados/team") {
    return sendJson(res, 200, []);
  }
  if (
    req.method === "GET" &&
    [
      "/solicitacoes/ferias/todas",
      "/solicitacoes/ajustes/todas",
      "/solicitacoes/compensacoes/todas",
    ].includes(url.pathname)
  ) {
    return sendJson(res, 200, []);
  }
  if (req.method === "GET" && url.pathname === "/time-entries") {
    return sendJson(res, 200, []);
  }
  if (req.method === "GET" && url.pathname === "/time-entries/team") {
    return sendJson(res, 200, []);
  }
  if (req.method === "GET" && url.pathname === "/operacional/escala") {
    return sendJson(res, 200, []);
  }
  if (req.method === "GET" && url.pathname === "/employees") {
    return sendJson(res, 200, []);
  }
  if (req.method === "GET" && url.pathname === "/convencoes") {
    return sendJson(res, 200, []);
  }
  if (req.method === "GET" && url.pathname === "/horas/resumo") {
    return sendJson(res, 200, []);
  }
  if (req.method === "GET" && url.pathname === "/horas") {
    return sendJson(res, 200, []);
  }
  if (req.method === "POST" && url.pathname === "/horas") {
    return sendJson(res, 201, { id: "generated-horas-id", ...body });
  }
  if (req.method === "DELETE" && /^\/horas\/[^/]+$/.test(url.pathname)) {
    return sendJson(res, 204, null);
  }
  if (req.method === "GET" && url.pathname === "/banco-de-horas/equipe") {
    return sendJson(res, 200, []);
  }
  if (req.method === "GET" && url.pathname === "/alertas") {
    return sendJson(res, 200, []);
  }
  if (
    req.method === "GET" &&
    ["/mural/posts", "/mural/birthdays"].includes(url.pathname)
  ) {
    return sendJson(res, 200, []);
  }
  if (req.method === "GET" && url.pathname === "/carreira/evaluations") {
    return sendJson(res, 200, null);
  }
  if (req.method === "POST" && url.pathname === "/carreira/evaluations") {
    return sendJson(res, 201, { id: "generated-evaluation-id", ...body });
  }
  if (req.method === "POST" && /^\/carreira\/evaluations\/[^/]+\/decidir$/.test(url.pathname)) {
    return sendJson(res, 200, { id: "generated-evaluation-id", status: "decidida", ...body });
  }
  if (req.method === "POST" && url.pathname === "/mural/posts") {
    return sendJson(res, 201, { id: "generated-post-id", ...body });
  }
  if (
    req.method === "GET" &&
    ["/beneficios/saldos/equipe", "/beneficios/parceiros"].includes(url.pathname)
  ) {
    return sendJson(res, 200, []);
  }
  if (req.method === "GET" && url.pathname === "/onboarding/equipe") {
    return sendJson(res, 200, []);
  }
  if (
    req.method === "GET" &&
    ["/operacional/sobreaviso/equipe", "/operacional/deslocamentos/equipe"].includes(
      url.pathname
    )
  ) {
    return sendJson(res, 200, []);
  }
  if (
    req.method === "GET" &&
    ["/documentos/admissionais/equipe", "/documentos/certificacoes/equipe"].includes(
      url.pathname
    )
  ) {
    return sendJson(res, 200, []);
  }
  if (req.method === "GET" && url.pathname === "/documentos/holerites/equipe") {
    return sendJson(res, 200, []);
  }
  if (req.method === "GET" && url.pathname === "/documentos/holerites") {
    return sendJson(res, 200, []);
  }
  if (req.method === "POST" && url.pathname === "/operacional/escala") {
    return sendJson(res, 201, { id: "generated-id", ...body });
  }
  if (req.method === "DELETE" && /^\/operacional\/escala\/[^/]+$/.test(url.pathname)) {
    return sendJson(res, 204, null);
  }
  if (req.method === "POST" && url.pathname === "/convencoes") {
    return sendJson(res, 201, { id: "generated-id", ...body });
  }
  if (req.method === "PATCH" && /^\/convencoes\/[^/]+$/.test(url.pathname)) {
    return sendJson(res, 200, { id: url.pathname.split("/")[2], ...body });
  }
  if (req.method === "DELETE" && /^\/convencoes\/[^/]+$/.test(url.pathname)) {
    return sendJson(res, 204, null);
  }
  if (req.method === "POST" && url.pathname === "/documentos/holerites") {
    return sendJson(res, 201, { id: "generated-id", ...body });
  }
  if (req.method === "PATCH" && /^\/documentos\/holerites\/[^/]+$/.test(url.pathname)) {
    return sendJson(res, 200, { id: url.pathname.split("/")[3], ...body });
  }
  if (req.method === "DELETE" && /^\/documentos\/holerites\/[^/]+$/.test(url.pathname)) {
    return sendJson(res, 204, null);
  }
  if (
    req.method === "PATCH" &&
    /^\/(atestados|solicitacoes\/(ferias|ajustes|compensacoes))\/[^/]+\/status$/.test(
      url.pathname
    )
  ) {
    return sendJson(res, 200, { ...body });
  }
  if (req.method === "PATCH" && /^\/employees\/[^/]+\/personal-data$/.test(url.pathname)) {
    return sendJson(res, 200, { userId: url.pathname.split("/")[2], ...body });
  }
  if (req.method === "PATCH" && /^\/employees\/[^/]+$/.test(url.pathname)) {
    return sendJson(res, 200, { userId: url.pathname.split("/")[2], ...body });
  }
  if (req.method === "POST" && url.pathname === "/employees") {
    return sendJson(res, 201, { userId: "generated-employee-id", ...body });
  }
  if (req.method === "GET" && url.pathname === "/employees/trash") {
    return sendJson(res, 200, []);
  }
  if (req.method === "DELETE" && /^\/employees\/[^/]+$/.test(url.pathname)) {
    return sendJson(res, 204, null);
  }
  if (req.method === "PATCH" && /^\/employees\/[^/]+\/restore$/.test(url.pathname)) {
    return sendJson(res, 200, { userId: url.pathname.split("/")[2], deletedAt: null });
  }
  if (req.method === "DELETE" && /^\/employees\/[^/]+\/permanent$/.test(url.pathname)) {
    return sendJson(res, 204, null);
  }
  // Default: invalid credentials — tests seed a success response for their
  // own email/senha combination via seedResponse, same as any other POST.
  if (req.method === "POST" && url.pathname === "/auth/password-login") {
    return sendJson(res, 401, { message: "Email ou senha incorretos." });
  }
  if (req.method === "POST" && url.pathname === "/auth/forgot-password") {
    return sendJson(res, 200, {});
  }
  if (req.method === "POST" && url.pathname === "/auth/reset-password") {
    return sendJson(res, 400, { message: "Código inválido ou expirado." });
  }

  if (req.method === "GET" && /^\/notifications\/pagamentos\/status\/[^/]+$/.test(url.pathname)) {
    return sendJson(res, 200, []);
  }

  if (req.method === "GET" && url.pathname === "/notifications/mine") {
    return sendJson(res, 200, []);
  }

  if (req.method === "POST" && /^\/notifications\/[^/]+\/read$/.test(url.pathname)) {
    return sendJson(res, 200, {});
  }

  sendJson(res, 404, { error: `no fake-api handler for ${req.method} ${url.pathname}` });
});

server.listen(PORT, () => {
  console.log(`Fake API server listening at http://localhost:${PORT}`);
});
