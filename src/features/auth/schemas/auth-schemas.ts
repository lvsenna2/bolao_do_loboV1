import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiuscula.")
  .regex(/[a-z]/, "A senha deve conter pelo menos uma letra minuscula.")
  .regex(/[0-9]/, "A senha deve conter pelo menos um numero.")
  .regex(/[^A-Za-z0-9]/, "A senha deve conter pelo menos um caractere especial.");

const dateInputSchema = z.string().refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);

  return value.length > 0 && !Number.isNaN(date.getTime());
}, "Informe uma data valida.");

export const loginSchema = z.object({
  email: z.string().email("Informe um e-mail valido.").trim().toLowerCase(),
  password: z.string().min(1, "Informe sua senha.")
});

export const registerSchema = z
  .object({
    firstName: z.string().min(2, "Informe seu nome.").max(80).trim(),
    lastName: z.string().min(2, "Informe seu sobrenome.").max(80).trim(),
    username: z
      .string()
      .min(3, "O username deve ter pelo menos 3 caracteres.")
      .max(40)
      .regex(/^[a-zA-Z0-9_]+$/, "Use apenas letras, numeros e underline.")
      .trim()
      .toLowerCase(),
    email: z.string().email("Informe um e-mail valido.").trim().toLowerCase(),
    birthDate: dateInputSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme sua senha."),
    acceptTerms: z.boolean().refine((value) => value, "Aceite os termos para continuar.")
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas nao conferem.",
    path: ["confirmPassword"]
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Informe um e-mail valido.").trim().toLowerCase()
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20, "Token invalido."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme sua senha.")
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas nao conferem.",
    path: ["confirmPassword"]
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
