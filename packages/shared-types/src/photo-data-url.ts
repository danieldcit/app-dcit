import { z } from "zod";

// A device-local file:// or content:// path is never reachable outside that
// device, so every photo field must carry the actual image as a data: URL —
// shared by AtestadoInputSchema and AdmissionDocumentInputSchema so neither
// can regress to accepting a local-path shape.
export const PHOTO_DATA_URL_PATTERN = /^data:image\/(jpeg|png|webp);base64,/;

export function photoDataUrlSchema() {
  return z.string().regex(PHOTO_DATA_URL_PATTERN, "A foto precisa ser enviada como imagem.");
}
