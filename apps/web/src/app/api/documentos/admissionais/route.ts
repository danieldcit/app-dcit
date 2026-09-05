import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// See apps/web/src/app/api/atestados/route.ts for why this is a plain Route
// Handler instead of a Server Action — same base64-photo-through-Flight
// problem applies here.
export async function POST(request: Request) {
  const body = await request.text();
  const res = await apiFetch("/documentos/admissionais", {
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
