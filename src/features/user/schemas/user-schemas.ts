import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiuscula.")
  .regex(/[a-z]/, "A senha deve conter pelo menos uma letra minuscula.")
  .regex(/[0-9]/, "A senha deve conter pelo menos um numero.")
  .regex(/[^A-Za-z0-9]/, "A senha deve conter pelo menos um caractere especial.");

const optionalUrlSchema = z.string().url("Informe uma URL valida.").optional().or(z.literal(""));

export const updateProfileSchema = z.object({
  firstName: z.string().min(2, "Informe seu nome.").max(80).trim(),
  lastName: z.string().min(2, "Informe seu sobrenome.").max(80).trim(),
  username: z
    .string()
    .min(3, "O username deve ter pelo menos 3 caracteres.")
    .max(40)
    .regex(/^[a-zA-Z0-9_]+$/, "Use apenas letras, numeros e underline.")
    .trim()
    .toLowerCase(),
  avatarUrl: optionalUrlSchema,
  locale: z.string().min(2).max(12).trim(),
  theme: z.enum(["system", "light", "dark"])
});

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe sua senha atual."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme sua nova senha.")
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas nao conferem.",
    path: ["confirmPassword"]
  });

export const notificationIdSchema = z.object({
  notificationId: z.string().uuid("Notificacao invalida.")
});

export const deleteAccountSchema = z.object({
  confirm: z.literal("EXCLUIR", {
    errorMap: () => ({ message: "Digite EXCLUIR para confirmar." })
  })
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
