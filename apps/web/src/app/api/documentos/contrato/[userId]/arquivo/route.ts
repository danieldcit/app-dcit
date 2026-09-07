import { apiFetch } from "@/lib/api";

// Turns the API's { fileDataUrl } JSON response into a real downloadable
// file — lets both the colaborador's own box and the gestor/RH team list
// use a plain <a href> link instead of client-side blob juggling.
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const res = await apiFetch(`/documentos/contrato/${userId}/arquivo`);
  if (!res.ok) {
    return new Response(null, { status: res.status });
  }
  const { fileDataUrl } = (await res.json()) as { fileDataUrl: string | null };
  if (!fileDataUrl) {
    return new Response(null, { status: 404 });
  }
  const base64 = fileDataUrl.slice(fileDataUrl.indexOf(",") + 1);
  const buffer = Buffer.from(base64, "base64");
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="contrato-assinado.pdf"',
    },
  });
}
