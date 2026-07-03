import {
  AccountStatus,
  ChampionshipStatus,
  LeagueStatus,
  MatchStatus,
  PaymentStatus,
  RoundStatus,
  UserRole
} from "@prisma/client";
import { z } from "zod";

export const userRoleSchema = z.nativeEnum(UserRole);
export const accountStatusSchema = z.nativeEnum(AccountStatus);
export const championshipStatusSchema = z.nativeEnum(ChampionshipStatus);
export const leagueStatusSchema = z.nativeEnum(LeagueStatus);
export const matchStatusSchema = z.nativeEnum(MatchStatus);
export const paymentStatusSchema = z.nativeEnum(PaymentStatus);
export const roundStatusSchema = z.nativeEnum(RoundStatus);

const uuidSchema = z.string().uuid("Identificador invalido.");

export const updateUserRoleSchema = z.object({
  userId: uuidSchema,
  role: userRoleSchema
});

export const updateUserStatusSchema = z.object({
  userId: uuidSchema,
  status: accountStatusSchema
});

export const softDeleteUserSchema = z.object({
  userId: uuidSchema
});

export const createChampionshipSchema = z.object({
  name: z.string().min(2, "Informe o nome.").max(120).trim(),
  country: z.string().min(2, "Informe o pais.").max(80).trim(),
  seasonYear: z.coerce
    .number()
    .int()
    .min(1900, "Temporada invalida.")
    .max(2200, "Temporada invalida.")
    .optional(),
  logo: z.string().url("Informe uma URL valida.").optional().or(z.literal("")),
  description: z.string().max(500).optional().or(z.literal("")),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Use uma cor hexadecimal, como #2563EB.")
    .optional()
    .or(z.literal("")),
  provider: z.string().max(40).optional().or(z.literal("")),
  apiId: z.coerce.number().int().positive().optional().or(z.literal("")),
  status: championshipStatusSchema.default("ACTIVE")
});

export const updateChampionshipStatusSchema = z.object({
  championshipId: uuidSchema,
  status: championshipStatusSchema
});

export const createTeamSchema = z.object({
  name: z.string().min(2, "Informe o nome da equipe.").max(120).trim(),
  shortName: z.string().max(30).optional().or(z.literal("")),
  country: z.string().min(2, "Informe o pais.").max(80).trim(),
  logo: z.string().url("Informe uma URL valida.").optional().or(z.literal("")),
  apiId: z.coerce.number().int().positive().optional().or(z.literal(""))
});

export const createRoundSchema = z
  .object({
    seasonId: uuidSchema,
    leagueId: uuidSchema,
    number: z.coerce.number().int().min(1, "Informe o numero da rodada."),
    name: z.string().max(80).optional().or(z.literal("")),
    description: z.string().max(500).optional().or(z.literal("")),
    startsAt: z.coerce.date({ invalid_type_error: "Informe a data inicial." }),
    endsAt: z.coerce.date({ invalid_type_error: "Informe a data final." }),
    status: roundStatusSchema.default("SCHEDULED")
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "A data final deve ser posterior a data inicial.",
    path: ["endsAt"]
  });

export const updateRoundStatusSchema = z.object({
  roundId: uuidSchema,
  status: roundStatusSchema
});

export const openRoundSchema = z.object({
  roundId: uuidSchema
});

export const createMatchSchema = z
  .object({
    roundId: uuidSchema,
    homeTeamId: uuidSchema,
    awayTeamId: uuidSchema,
    kickoff: z.coerce.date({ invalid_type_error: "Informe a data e horario da partida." }),
    stadium: z.string().max(160).optional().or(z.literal("")),
    city: z.string().max(100).optional().or(z.literal("")),
    country: z.string().max(80).optional().or(z.literal("")),
    referee: z.string().max(120).optional().or(z.literal("")),
    broadcast: z.string().max(120).optional().or(z.literal("")),
    status: matchStatusSchema.default("SCHEDULED")
  })
  .refine((data) => data.homeTeamId !== data.awayTeamId, {
    message: "Mandante e visitante devem ser equipes diferentes.",
    path: ["awayTeamId"]
  });

export const updateMatchStatusSchema = z.object({
  matchId: uuidSchema,
  status: matchStatusSchema
});

const officialScoreSchema = z.coerce
  .number({
    invalid_type_error: "Informe um placar valido."
  })
  .int("Use apenas numeros inteiros.")
  .min(0, "O placar nao pode ser negativo.")
  .max(99, "Informe um placar menor que 100.");

export const homologateMatchResultSchema = z.object({
  matchId: uuidSchema,
  homeScore: officialScoreSchema,
  awayScore: officialScoreSchema
});

export const updateLeagueStatusSchema = z.object({
  leagueId: uuidSchema,
  status: leagueStatusSchema
});

export const updatePaymentStatusSchema = z.object({
  paymentId: uuidSchema,
  status: paymentStatusSchema
});

export const generalSettingsSchema = z.object({
  platformName: z.string().min(2).max(120).trim(),
  currency: z.string().min(3).max(8).trim().toUpperCase(),
  language: z.string().min(2).max(12).trim(),
  timezone: z.string().min(3).max(80).trim(),
  supportEmail: z.string().email("Informe um e-mail valido.").optional().or(z.literal("")),
  footballApiProvider: z.string().max(80).optional().or(z.literal(""))
});

export type CreateChampionshipInput = z.infer<typeof createChampionshipSchema>;
export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type CreateRoundInput = z.infer<typeof createRoundSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type GeneralSettingsInput = z.infer<typeof generalSettingsSchema>;
export type HomologateMatchResultInput = z.infer<typeof homologateMatchResultSchema>;
