import { z } from "zod";
import { photoDataUrlSchema } from "./photo-data-url";

export const AvatarUploadInputSchema = z.object({
  photo: photoDataUrlSchema(),
});
export type AvatarUploadInput = z.infer<typeof AvatarUploadInputSchema>;
