import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Same reasoning as apps/web/src/app/api/atestados/route.ts: this used to be
// a "use server" action called directly as a function
// (runAtestadoOcr(base64, mediaType)) — calling a Server Action that way
// still serializes its arguments through React's Flight protocol, so a real
// photo's base64 hit "Maximum array nesting exceeded" here too, silently
// (the call isn't a form submission, so the failure never surfaced as a
// visible error — OCR just never ran for a large photo).
export async function POST(request: Request) {
  const body = await request.text();
  const res = await apiFetch("/atestados/ocr", {
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
