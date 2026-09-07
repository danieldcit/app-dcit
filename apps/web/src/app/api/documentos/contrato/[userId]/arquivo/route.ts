import { apiFetch } from "@/lib/api";

// Turns the API's { fileDataUrl } JSON response into a real downloadable
// file — lets both the colaborador's own box and the gestor/RH team list
// use a plain <a href> link instead of client-side blob juggling.
export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
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
  // ?inline=1 opens the PDF in the browser's own viewer (used by the
  // "Visualizar" link) instead of forcing a download (the default, used by
  // "Baixar") — same file, just a different Content-Disposition.
  const inline = new URL(request.url).searchParams.has("inline");
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="contrato-assinado.pdf"`,
    },
  });
}
