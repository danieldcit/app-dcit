import { z } from "zod";
import { pdfDataUrlSchema } from "./pdf-data-url";

// One signed contract per colaborador — resubmitting replaces the previous
// file (see DocumentosService.submitSignedContract), same upsert-by-userId
// pattern as AdmissionDocument's upsert-by-(userId, kind).
export const SignedContractInputSchema = z.object({
  fileDataUrl: pdfDataUrlSchema(),
});
export type SignedContractInput = z.infer<typeof SignedContractInputSchema>;
