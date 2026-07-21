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

import { preprocessSaoPauloDateTimeLocal } from "@/lib/date-time";

export const userRoleSchema = z.nativeEnum(UserRole);
export const accountStatusSchema = z.nativeEnum(AccountStatus);
export const championshipStatusSchema = z.nativeEnum(ChampionshipStatus);
export const leagueStatusSchema = z.nativeEnum(LeagueStatus);
export const matchStatusSchema = z.nativeEnum(MatchStatus);
export const paymentStatusSchema = z.nativeEnum(PaymentStatus);
export const roundStatusSchema = z.nativeEnum(RoundStatus);

const uuidSchema = z.string().uuid("Identificador invalido.");
const formBooleanSchema = z.preprocess(
  (value) => value === true || value === "true" || value === "on" || value === "1",
  z.boolean()
);

function saoPauloDateTimeSchema(message: string) {
  return z.preprocess(
    preprocessSaoPauloDateTimeLocal,
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
    .regex(/^#[0-9A-Fa-f]{6}$/, "Use uma cor hexadecimal, como #F2B91C.")
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

export const updateLeagueXpEnabledSchema = z.object({
  leagueId: uuidSchema,
  xpEnabled: formBooleanSchema
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

export const updateXpLevelSchema = z
  .object({
    levelId: uuidSchema,
    name: z.string().min(2, "Informe o nome.").max(80).trim(),
    medal: z.string().min(1, "Informe a medalha.").max(20).trim(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use uma cor hexadecimal, como #FBBF24."),
    minXp: z.coerce.number().int().min(0, "XP minimo invalido."),
    maxXp: z.coerce.number().int().min(0, "XP maximo invalido.").optional().or(z.literal("")),
    discountPercent: z.coerce.number().int().min(0).max(100),
    active: formBooleanSchema.optional()
  })
  .refine((data) => data.maxXp === "" || data.maxXp === undefined || data.maxXp >= data.minXp, {
    message: "XP maximo deve ser maior ou igual ao minimo.",
    path: ["maxXp"]
  });

export const createXpLevelSchema = z
  .object({
    key: z
      .string()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9-]+$/, "Use apenas letras, numeros e hifens."),
    name: z.string().min(2, "Informe o nome.").max(80).trim(),
    medal: z.string().min(1, "Informe a medalha.").max(20).trim(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use uma cor hexadecimal, como #FBBF24."),
    minXp: z.coerce.number().int().min(0, "XP minimo invalido."),
    maxXp: z.coerce.number().int().min(0, "XP maximo invalido.").optional().or(z.literal("")),
    discountPercent: z.coerce.number().int().min(0).max(100),
    sortOrder: z.coerce.number().int().min(1).max(999),
    active: formBooleanSchema.optional()
  })
  .refine((data) => data.maxXp === "" || data.maxXp === undefined || data.maxXp >= data.minXp, {
    message: "XP maximo deve ser maior ou igual ao minimo.",
    path: ["maxXp"]
  });

export const updateXpTypeConfigSchema = z.object({
  typeConfigId: uuidSchema,
  amount: z.coerce.number().int().min(-100000).max(100000),
  active: formBooleanSchema.optional()
});

export const createXpTypeConfigSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[A-Z0-9_]+$/, "Use letras maiusculas, numeros e _."),
  label: z.string().min(2).max(120).trim(),
  description: z.string().max(500).optional().or(z.literal("")),
  amount: z.coerce.number().int().min(-100000).max(100000),
  active: formBooleanSchema.optional()
});

export const createAchievementBadgeSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[A-Z0-9_]+$/, "Use letras maiusculas, numeros e _."),
  title: z.string().min(2).max(100).trim(),
  description: z.string().min(3).max(500).trim(),
  rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"])
});

export const grantLeagueBadgeSchema = z.object({
  category: z.enum([
    "CHAMPION",
    "RUNNER_UP",
    "MOST_HITS",
    "MOST_EXACT_SCORES",
    "ROUND_STAR",
    "CONSISTENCY",
    "PARTICIPATION",
    "FAIR_PLAY",
    "CUSTOM"
  ]),
  championshipId: uuidSchema,
  customTitle: z
    .string()
    .trim()
    .max(100)
    .transform((value) => value || undefined)
    .optional(),
  emblemColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, "Selecione uma cor valida.")
    .transform((value) => value.toUpperCase()),
  emblemIcon: z.enum(["TROPHY", "CROWN", "TARGET", "STAR", "AWARD", "SHIELD"]),
  emblemStyle: z.enum(["MEDAL", "SHIELD", "SEAL", "RIBBON"]),
  reason: z
    .string()
    .trim()
    .max(240)
    .transform((value) => value || undefined)
    .optional(),
  userId: uuidSchema
});

export const revokeLeagueBadgeSchema = z.object({
  awardId: uuidSchema
});

export const createMissionSchema = z
  .object({
    key: z
      .string()
      .min(2)
      .max(80)
      .regex(/^[A-Z0-9_]+$/, "Use letras maiusculas, numeros e _."),
    title: z.string().min(2).max(140).trim(),
    description: z.string().min(3).max(500).trim(),
    type: z.string().min(2).max(80).trim(),
    target: z.coerce.number().int().min(1).max(100000),
    xpReward: z.coerce.number().int().min(0).max(100000),
    startsAt: saoPauloDateTimeSchema("Informe o inicio da missao."),
    endsAt: saoPauloDateTimeSchema("Informe o fim da missao."),
    active: formBooleanSchema.optional()
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "A data final deve ser posterior a inicial.",
    path: ["endsAt"]
  });

export const grantManualXpSchema = z.object({
  userId: uuidSchema,
  amount: z.coerce
    .number({
      invalid_type_error: "Informe a quantidade de XP."
    })
    .int("Use apenas numeros inteiros.")
    .min(-100000, "Remocao muito alta.")
    .max(100000, "Bonus muito alto.")
    .refine((value) => value !== 0, "Informe um valor diferente de zero."),
  reason: z.string().min(3, "Informe o motivo.").max(240).trim()
});

export const recalculateUserXpSchema = z.object({
  userId: z.union([uuidSchema, z.literal(""), z.literal("all")]).optional()
});

export const updateXpSettingsSchema = z.object({
  paidLeagueMinimumEntryFee: z.coerce.number().min(0, "Valor minimo invalido.").max(100000)
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
