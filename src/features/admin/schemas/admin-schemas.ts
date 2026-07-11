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

function parseSaoPauloDateTimeLocal(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  const dateTimeLocalPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;

  if (!dateTimeLocalPattern.test(trimmedValue)) {
    return value;
  }

  const withSeconds = trimmedValue.length === 16 ? `${trimmedValue}:00` : trimmedValue;

  return new Date(`${withSeconds}-03:00`);
}

function saoPauloDateTimeSchema(message: string) {
  return z.preprocess(
    parseSaoPauloDateTimeLocal,
    z.coerce.date({
      invalid_type_error: message
    })
  );
}

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

export const deleteChampionshipSchema = z.object({
  championshipId: uuidSchema
});

export const createTeamSchema = z.object({
  name: z.string().min(2, "Informe o nome da equipe.").max(120).trim(),
  shortName: z.string().max(30).optional().or(z.literal("")),
  country: z.string().min(2, "Informe o pais.").max(80).trim(),
  logo: z.string().url("Informe uma URL valida.").optional().or(z.literal("")),
  apiId: z.coerce.number().int().positive().optional().or(z.literal(""))
});

export const bulkImportTeamsSchema = z.object({
  teams: z
    .string()
    .min(5, "Informe pelo menos uma equipe.")
    .max(30000, "Envie no maximo 30.000 caracteres.")
});

export const importTeamPresetSchema = z.object({
  preset: z.enum(["national-teams", "brazil-clubs"])
});

export const importApiFootballTeamsSchema = z
  .object({
    country: z.string().max(80).trim().optional().or(z.literal("")),
    leagueId: z.coerce.number().int().positive().optional().or(z.literal("")),
    season: z.coerce.number().int().min(1900).max(2200).optional().or(z.literal(""))
  })
  .refine(
    (data) => {
      const hasCountry = typeof data.country === "string" && data.country.length > 0;
      const hasLeagueSeason = typeof data.leagueId === "number" && typeof data.season === "number";

      return hasCountry || hasLeagueSeason;
    },
    {
      message: "Informe um pais ou o ID da liga com temporada.",
      path: ["country"]
    }
  );

export const syncFootballCompetitionSchema = z.object({
  competitionKey: z.string().min(2, "Competicao invalida.").max(80),
  force: z.coerce.boolean().optional()
});

export const syncAllFootballCompetitionsSchema = z.object({
  force: z.coerce.boolean().optional()
});

export const createRoundSchema = z
  .object({
    seasonId: uuidSchema,
    leagueId: uuidSchema,
    number: z.coerce.number().int().min(1, "Informe o numero da rodada."),
    name: z.string().max(80).optional().or(z.literal("")),
    description: z.string().max(500).optional().or(z.literal("")),
    startsAt: saoPauloDateTimeSchema("Informe a data inicial."),
    endsAt: saoPauloDateTimeSchema("Informe a data final."),
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

export const deleteRoundSchema = z.object({
  roundId: uuidSchema
});

export const createMatchSchema = z
  .object({
    roundId: uuidSchema,
    homeTeamId: uuidSchema,
    awayTeamId: uuidSchema,
    kickoff: saoPauloDateTimeSchema("Informe a data e horario da partida."),
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

export const updateLeagueChampionshipSchema = z.object({
  championshipId: uuidSchema,
  leagueId: uuidSchema
});

export const recalculateLeagueRankingSchema = z.object({
  leagueId: uuidSchema
});

export const adjustLeagueRankingSchema = z.object({
  leagueId: uuidSchema,
  pointsDelta: z.coerce
    .number({
      invalid_type_error: "Informe a quantidade de pontos."
    })
    .int("Use apenas numeros inteiros.")
    .min(-100000, "Desconto muito alto.")
    .max(100000, "Bonus muito alto.")
    .refine((value) => value !== 0, "Informe um valor diferente de zero."),
  reason: z.string().min(3, "Informe o motivo.").max(240, "Use no maximo 240 caracteres.").trim(),
  userId: uuidSchema
});

export const deleteLeagueSchema = z.object({
  leagueId: uuidSchema
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
export type ImportApiFootballTeamsInput = z.infer<typeof importApiFootballTeamsSchema>;
