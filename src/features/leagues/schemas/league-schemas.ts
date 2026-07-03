import { LeagueVisibility } from "@prisma/client";
import { z } from "zod";

const optionalDateSchema = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce.date({ invalid_type_error: "Informe uma data valida." }).optional()
);

const optionalMaxMembersSchema = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce
    .number({ invalid_type_error: "Informe um numero valido." })
    .int("Use apenas numeros inteiros.")
    .min(2, "A liga deve permitir pelo menos 2 participantes.")
    .max(100000, "Informe um limite menor.")
    .optional()
);

const entryFeeSchema = z.preprocess(
  (value) => (value === "" || value == null ? 0 : value),
  z.coerce
    .number({ invalid_type_error: "Informe um valor valido." })
    .min(0, "O valor de entrada nao pode ser negativo.")
    .max(999999.99, "Informe um valor menor.")
);

const createLeagueBaseSchema = z.object({
  name: z.string().min(2, "Informe o nome da liga.").max(120).trim(),
  description: z.string().max(500, "Use no maximo 500 caracteres.").optional().or(z.literal("")),
  imageUrl: z.string().url("Informe uma URL valida.").optional().or(z.literal("")),
  visibility: z.nativeEnum(LeagueVisibility).default("PRIVATE"),
  entryFee: entryFeeSchema,
  maxMembers: optionalMaxMembersSchema,
  startsAt: optionalDateSchema,
  endsAt: optionalDateSchema
});

function dateRangeIsValid(data: { startsAt?: Date; endsAt?: Date }) {
  return !data.startsAt || !data.endsAt || data.endsAt > data.startsAt;
}

export const createLeagueSchema = createLeagueBaseSchema.refine(dateRangeIsValid, {
  message: "A data final deve ser posterior a data inicial.",
  path: ["endsAt"]
});

export const createAdminLeagueSchema = createLeagueBaseSchema
  .extend({
    ownerEmail: z.string().email("Informe um e-mail valido.").optional().or(z.literal(""))
  })
  .refine(dateRangeIsValid, {
    message: "A data final deve ser posterior a data inicial.",
    path: ["endsAt"]
  });

export const joinLeagueSchema = z.object({
  inviteCode: z
    .string()
    .min(4, "Informe o codigo da liga.")
    .max(32, "Codigo invalido.")
    .trim()
    .toUpperCase()
});

export const joinPublicLeagueSchema = z.object({
  leagueId: z.string().uuid("Liga invalida.")
});

export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;
export type CreateAdminLeagueInput = z.infer<typeof createAdminLeagueSchema>;
export type JoinLeagueInput = z.infer<typeof joinLeagueSchema>;
export type JoinPublicLeagueInput = z.infer<typeof joinPublicLeagueSchema>;
