import { z } from "zod";

// Same reasoning as photo-data-url.ts: a device-local file:// path is never
// reachable outside that device, so the signed contract must travel as an
// actual data: URL.
export const PDF_DATA_URL_PATTERN = /^data:application\/pdf;base64,/;

export function pdfDataUrlSchema() {
  return z.string().regex(PDF_DATA_URL_PATTERN, "O arquivo precisa ser um PDF.");
}
