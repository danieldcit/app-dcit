import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Plain Route Handler, not a Server Action — same base64-payload-through-
// Flight problem as apps/web/src/app/api/documentos/admissionais/route.ts.
export async function POST(request: Request) {
  const body = await request.text();
  const res = await apiFetch("/documentos/contrato", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
