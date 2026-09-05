import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// A plain Route Handler, not a Server Action: a base64 photo (a few MB once
// a real phone/scanner photo is encoded) blows past React's Flight
// serialization for Server Action arguments ("Maximum array nesting
// exceeded") long before it would ever hit the Nest API's own 10mb body
// limit. A Route Handler is just a normal HTTP request/response — no RSC
// boundary, no such cap — so the client posts JSON here directly instead of
// calling a "use server" action.
export async function POST(request: Request) {
  const body = await request.text();
  const res = await apiFetch("/atestados", {
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
