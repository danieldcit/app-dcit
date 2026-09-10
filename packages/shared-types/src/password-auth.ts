import { z } from "zod";

export const PasswordLoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  origin: z.enum(["web", "mobile"]),
});
export type PasswordLoginInput = z.infer<typeof PasswordLoginInputSchema>;

// Aceita email ou telefone — a service decide qual usar pra achar a conta.
export const ForgotPasswordInputSchema = z.object({
  identifier: z.string().min(1),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;

export const ResetPasswordInputSchema = z.object({
  identifier: z.string().min(1),
  code: z.string().length(6),
  newPassword: z.string().min(8),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;

// Logged-in flow (vs. resetPassword above, which is the deslogado "esqueci
// minha senha" flow keyed by identifier+code) — proves possession of the
// account by the current password rather than a reset code.
export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;
