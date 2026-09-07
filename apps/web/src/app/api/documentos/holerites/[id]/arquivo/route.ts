import { apiFetch } from "@/lib/api";

// The API generates the holerite PDF on the fly and streams raw bytes back —
// this route exists only to forward the session's Bearer token, the same
// reason apps/api/documentos/contrato/[userId]/arquivo/route.ts exists for
// the signed contract.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await apiFetch(`/documentos/holerites/${id}/arquivo`);
  if (!res.ok) {
    return new Response(null, { status: res.status });
  }
  const buffer = await res.arrayBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="holerite.pdf"',
    },
  });
}
