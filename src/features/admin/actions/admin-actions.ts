"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getTeamPreset } from "@/features/admin/data/team-presets";
import { sendIntegrationAnnouncementEmailOnce } from "@/features/auth/services/auth-email-service";
import {
  recalculateLeagueRanking,
  recalculateRankingsForMatch
} from "@/features/ranking/services/ranking-service";
import { processMatchScores } from "@/features/scoring/services/scoring-service";
import {
  evaluateAchievementsForUser,
  grantManualXp,
  grantMatchResultXp,
  recalculateAllUsersXp,
  recalculateXpForUser,
  setPaidLeagueMinimumEntryFee,
  syncActiveLeagueMissionProgress
} from "@/features/xp/services/xp-service";
import { serverNow } from "@/lib/date-time";
import { requireAdmin } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { isEmailDeliveryConfigured } from "@/server/email/resend";
import { fetchApiFootballTeams } from "@/server/football-api/client";
import {
  footballCompetitionConfigs,
  getFootballCompetitionConfig
} from "@/server/football-api/competitions";
import {
  syncFootballCompetition,
  syncFootballCompetitionScores
} from "@/server/football-api/sync-service";
import {
  bulkImportTeamsSchema,
  createAchievementBadgeSchema,
  createChampionshipSchema,
  createMissionSchema,
  createMatchSchema,
  createRoundSchema,
  createTeamSchema,
  createXpLevelSchema,
  createXpTypeConfigSchema,
  deleteChampionshipSchema,
  deleteLeagueSchema,
  deleteRoundSchema,
  generalSettingsSchema,
  homologateMatchResultSchema,
  importApiFootballTeamsSchema,
  importTeamPresetSchema,
  openRoundSchema,
  recalculateLeagueRankingSchema,
  recalculateUserXpSchema,
  softDeleteUserSchema,
  syncAllFootballCompetitionScoresSchema,
  syncAllFootballCompetitionsSchema,
  syncFootballCompetitionScoresSchema,
  syncFootballCompetitionSchema,
  updateLeagueXpEnabledSchema,
  updateChampionshipStatusSchema,
  updateLeagueChampionshipSchema,
  updateLeagueStatusSchema,
  updateMatchStatusSchema,
  updatePaymentStatusSchema,
  updateRoundStatusSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  adjustLeagueRankingSchema,
  updateXpLevelSchema,
  updateXpSettingsSchema,
  updateXpTypeConfigSchema,
  grantManualXpSchema
} from "../schemas/admin-schemas";
import type { AdminActionResult } from "../types";

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function normalizeFieldErrors(fieldErrors: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => {
      return Array.isArray(entry[1]) && entry[1].length > 0;
    })
  );
}

async function createAuditLog(
  adminId: string,
  action: string,
  entity: string,
  entityId: string,
  oldValue?: unknown,
  newValue?: unknown
) {
  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action,
      entity,
      entityId,
      oldValue: oldValue === undefined ? undefined : JSON.parse(JSON.stringify(oldValue)),
      newValue: newValue === undefined ? undefined : JSON.parse(JSON.stringify(newValue))
    }
  });
}

function revalidateAdminPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/campeonatos");
  revalidatePath("/admin/times");
  revalidatePath("/admin/sincronizacao");
  revalidatePath("/admin/rodadas");
  revalidatePath("/admin/ligas");
  revalidatePath("/admin/rankings");
  revalidatePath("/admin/pagamentos");
  revalidatePath("/admin/palpites");
  revalidatePath("/admin/auditoria");
  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin/xp");
  revalidatePath("/rodadas");
  revalidatePath("/palpites");
  revalidatePath("/comparar-palpites");
  revalidatePath("/ranking");
  revalidatePath("/ligas");
  revalidatePath("/dashboard");
  revalidatePath("/perfil");
  revalidatePath("/xp-ranking");
  revalidatePath("/estatisticas");
  revalidatePath("/minhas-ligas");
}

function createDeletedUserIdentity(userId: string) {
  const compactId = userId.replaceAll("-", "");

  return {
    email: `deleted+${userId}@deleted.bolaodolobo.local`,
    username: `deleted_${compactId.slice(0, 24)}`
  };
}

type ImportableTeam = {
  apiId?: number | null;
  country: string;
  logo?: string | null;
  name: string;
  shortName?: string | null;
};

type TeamImportSummary = {
  created: number;
  invalid: number;
  skipped: number;
  updated: number;
};

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function cleanLogoUrl(value: string | null | undefined) {
  const logo = cleanText(value);

  return logo && /^https?:\/\//i.test(logo) ? logo : null;
}

function normalizeImportableTeam(team: ImportableTeam) {
  const name = cleanText(team.name);
  const country = cleanText(team.country);

  if (!name || !country) {
    return null;
  }

  return {
    apiId: typeof team.apiId === "number" && team.apiId > 0 ? team.apiId : null,
    country,
    logo: cleanLogoUrl(team.logo),
    name,
    shortName: cleanText(team.shortName)
  } satisfies ImportableTeam;
}

function prepareTeamsForImport(rawTeams: ImportableTeam[]) {
  const uniqueTeams = new Map<string, ImportableTeam>();
  let invalid = 0;
  let skipped = 0;

  rawTeams.forEach((rawTeam) => {
    const team = normalizeImportableTeam(rawTeam);

    if (!team) {
      invalid += 1;
      return;
    }

    const key = team.apiId
      ? `api:${team.apiId}`
      : `manual:${team.name.toLowerCase()}|${team.country.toLowerCase()}`;

    if (uniqueTeams.has(key)) {
      skipped += 1;
    }

    uniqueTeams.set(key, team);
  });

  return {
    invalid,
    skipped,
    teams: [...uniqueTeams.values()]
  };
}

function parseBulkTeamLines(value: string) {
  const teams: ImportableTeam[] = [];
  let invalid = 0;

  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const delimiter = line.includes(";") ? ";" : ",";
      const fields = line.split(delimiter).map((field) => field.trim());
      const [name, shortNameOrCountry, countryOrLogo, logoOrApiId, apiId] = fields;

      if (!name || !shortNameOrCountry) {
        invalid += 1;
        return;
      }

      if (!countryOrLogo) {
        teams.push({
          country: shortNameOrCountry,
          name
        });
        return;
      }

      const parsedApiId = apiId ? Number(apiId) : Number(logoOrApiId);
      const hasParsedApiId = Number.isFinite(parsedApiId) && parsedApiId > 0;

      teams.push({
        apiId: hasParsedApiId ? parsedApiId : undefined,
        country: countryOrLogo,
        logo: hasParsedApiId ? undefined : logoOrApiId,
        name,
        shortName: shortNameOrCountry
      });
    });

  return {
    invalid,
    teams
  };
}

function getTeamImportMessage(summary: TeamImportSummary) {
  return `Importacao concluida: ${summary.created} criados, ${summary.updated} atualizados, ${summary.skipped} ignorados e ${summary.invalid} invalidos.`;
}

async function importTeamsIntoDatabase(
  adminId: string,
  source: string,
  rawTeams: ImportableTeam[],
  invalidOffset = 0
) {
  const prepared = prepareTeamsForImport(rawTeams);

  if (prepared.teams.length === 0) {
    return {
      created: 0,
      invalid: prepared.invalid + invalidOffset,
      skipped: prepared.skipped,
      updated: 0
    } satisfies TeamImportSummary;
  }

  const summary: TeamImportSummary = {
    created: 0,
    invalid: prepared.invalid + invalidOffset,
    skipped: prepared.skipped,
    updated: 0
  };

  for (const team of prepared.teams) {
    const existingByApiId = team.apiId
      ? await prisma.team.findUnique({
          select: {
            apiId: true,
            country: true,
            id: true,
            logo: true,
            name: true,
            shortName: true
          },
          where: {
            apiId: team.apiId
          }
        })
      : null;

    const existingByName = await prisma.team.findFirst({
      select: {
        apiId: true,
        country: true,
        id: true,
        logo: true,
        name: true,
        shortName: true
      },
      where: {
        apiId: null,
        country: {
          equals: team.country,
          mode: "insensitive"
        },
        name: {
          equals: team.name,
          mode: "insensitive"
        }
      }
    });

    const existingTeam = existingByApiId ?? existingByName;

    if (team.apiId && !existingByName) {
      await prisma.team.upsert({
        create: {
          apiId: team.apiId,
          country: team.country,
          logo: team.logo,
          name: team.name,
          shortName: team.shortName
        },
        update: {
          country: team.country,
          logo: team.logo ?? undefined,
          name: team.name,
          shortName: team.shortName ?? undefined
        },
        where: {
          apiId: team.apiId
        }
      });

      if (existingByApiId) {
        summary.updated += 1;
      } else {
        summary.created += 1;
      }
    } else if (existingTeam) {
      await prisma.team.update({
        data: {
          apiId: existingTeam.apiId ?? team.apiId ?? null,
          country: team.country,
          logo: team.logo ?? existingTeam.logo,
          name: team.name,
          shortName: team.shortName || existingTeam.shortName
        },
        where: {
          id: existingTeam.id
        }
      });
      summary.updated += 1;
    } else {
      await prisma.team.create({
        data: {
          apiId: team.apiId ?? null,
          country: team.country,
          logo: team.logo,
          name: team.name,
          shortName: team.shortName
        }
      });
      summary.created += 1;
    }
  }

  try {
    await prisma.auditLog.create({
      data: {
        action: "admin.team.imported",
        entity: "Team",
        entityId: "bulk",
        newValue: {
          source,
          ...summary
        },
        userId: adminId
      }
    });
  } catch {
    // A importacao de times deve continuar mesmo se o log administrativo falhar.
  }

  revalidateAdminPaths();

  return summary;
}

export async function updateUserRoleAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = updateUserRoleSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Dados invalidos.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  if (parsedInput.data.userId === admin.id) {
    return {
      ok: false,
      message: "Voce nao pode alterar sua propria permissao."
    };
  }

  const currentUser = await prisma.user.findUnique({
    where: {
      id: parsedInput.data.userId
    },
    select: {
      id: true,
      role: true
    }
  });

  if (!currentUser) {
    return {
      ok: false,
      message: "Usuario nao encontrado."
    };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: currentUser.id
      },
      data: {
        role: parsedInput.data.role
      }
    }),
    prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "admin.user.role_updated",
        entity: "User",
        entityId: currentUser.id,
        oldValue: {
          role: currentUser.role
        },
        newValue: {
          role: parsedInput.data.role
        }
      }
    })
  ]);

  revalidateAdminPaths();

  return {
    ok: true,
    message: "Permissao atualizada."
  };
}

export async function updateUserStatusAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = updateUserStatusSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Dados invalidos.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  if (parsedInput.data.userId === admin.id) {
    return {
      ok: false,
      message: "Voce nao pode alterar seu proprio status."
    };
  }

  const currentUser = await prisma.user.findUnique({
    where: {
      id: parsedInput.data.userId
    },
    select: {
      email: true,
      id: true,
      status: true,
      username: true
    }
  });

  if (!currentUser) {
    return {
      ok: false,
      message: "Usuario nao encontrado."
    };
  }

  const deletedAt = parsedInput.data.status === "DELETED" ? serverNow() : null;
  const deletedIdentity =
    parsedInput.data.status === "DELETED" ? createDeletedUserIdentity(currentUser.id) : undefined;

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: currentUser.id
      },
      data: {
        ...(deletedIdentity ?? {}),
        status: parsedInput.data.status,
        deletedAt
      }
    }),
    prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "admin.user.status_updated",
        entity: "User",
        entityId: currentUser.id,
        oldValue: {
          email: currentUser.email,
          status: currentUser.status
        },
        newValue: {
          ...(deletedIdentity
            ? {
                email: deletedIdentity.email,
                username: deletedIdentity.username
              }
            : {}),
          status: parsedInput.data.status
        }
      }
    })
  ]);

  revalidateAdminPaths();

  return {
    ok: true,
    message: "Status atualizado."
  };
}

export async function softDeleteUserAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = softDeleteUserSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Dados invalidos.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  if (parsedInput.data.userId === admin.id) {
    return {
      ok: false,
      message: "Voce nao pode excluir sua propria conta administrativa."
    };
  }

  const currentUser = await prisma.user.findUnique({
    select: {
      id: true,
      email: true,
      username: true
    },
    where: {
      id: parsedInput.data.userId
    }
  });

  if (!currentUser) {
    return {
      ok: false,
      message: "Usuario nao encontrado."
    };
  }

  const deletedIdentity = createDeletedUserIdentity(currentUser.id);
  const user = await prisma.user.update({
    where: {
      id: currentUser.id
    },
    data: {
      ...deletedIdentity,
      status: "DELETED",
      deletedAt: serverNow()
    },
    select: {
      id: true,
      email: true,
      username: true
    }
  });

  await createAuditLog(admin.id, "admin.user.deleted", "User", user.id, currentUser, user);
  revalidateAdminPaths();

  return {
    ok: true,
    message: "Usuario removido com soft delete."
  };
}

export async function sendEmailIntegrationAnnouncementAction(): Promise<AdminActionResult> {
  const admin = await requireAdmin();

  if (!isEmailDeliveryConfigured()) {
    return {
      ok: false,
      message: "Envio de e-mail nao configurado. Configure RESEND_API_KEY no ambiente."
    };
  }

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "asc"
    },
    select: {
      email: true,
      id: true,
      name: true
    },
    where: {
      deletedAt: null,
      status: "ACTIVE"
    }
  });

  let failed = 0;
  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    const result = await sendIntegrationAnnouncementEmailOnce(admin.id, user);

    if (result === "sent") {
      sent += 1;
    } else if (result === "skipped") {
      skipped += 1;
    } else {
      failed += 1;
    }
  }

  await createAuditLog(
    admin.id,
    "admin.email.integration_announcement.sent",
    "Email",
    "integration-announcement",
    undefined,
    {
      failed,
      sent,
      skipped,
      total: users.length
    }
  );

  revalidateAdminPaths();

  if (failed > 0) {
    return {
      ok: false,
      message: `Aviso enviado para ${sent} usuario(s), ${skipped} ja haviam recebido e ${failed} falharam.`
    };
  }

  return {
    ok: true,
    message: `Aviso enviado para ${sent} usuario(s). ${skipped} ja haviam recebido.`
  };
}

export async function createChampionshipAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = createChampionshipSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise os dados do campeonato.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const data = parsedInput.data;
  const existingChampionship = await prisma.championship.findFirst({
    select: {
      id: true,
      name: true
    },
    where: {
      deletedAt: null,
      OR: [
        {
          country: {
            equals: data.country,
            mode: "insensitive"
          },
          name: {
            equals: data.name,
            mode: "insensitive"
          }
        },
        ...(typeof data.apiId === "number" && data.provider
          ? [
              {
                apiId: data.apiId,
                provider: data.provider
              }
            ]
          : [])
      ]
    }
  });

  if (existingChampionship) {
    return {
      ok: true,
      message: `Campeonato ${existingChampionship.name} ja estava cadastrado.`
    };
  }

  const championship = await prisma.championship.create({
    data: {
      name: data.name,
      country: data.country,
      logo: data.logo || null,
      description: data.description || null,
      primaryColor: data.primaryColor || null,
      provider: data.provider || null,
      apiId: typeof data.apiId === "number" ? data.apiId : null,
      status: data.status,
      seasons:
        typeof data.seasonYear === "number"
          ? {
              create: {
                year: data.seasonYear,
                name: String(data.seasonYear),
                status: "SCHEDULED"
              }
            }
          : undefined
    },
    select: {
      id: true,
      name: true,
      status: true
    }
  });

  await createAuditLog(
    admin.id,
    "admin.championship.created",
    "Championship",
    championship.id,
    undefined,
    championship
  );
  revalidateAdminPaths();

  return {
    ok: true,
    message: "Campeonato cadastrado."
  };
}

export async function updateChampionshipStatusAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = updateChampionshipStatusSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Dados invalidos.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const championship = await prisma.championship.update({
    where: {
      id: parsedInput.data.championshipId
    },
    data: {
      status: parsedInput.data.status
    },
    select: {
      id: true,
      status: true
    }
  });

  await createAuditLog(
    admin.id,
    "admin.championship.status_updated",
    "Championship",
    championship.id,
    undefined,
    championship
  );
  revalidateAdminPaths();

  return {
    ok: true,
    message: "Status do campeonato atualizado."
  };
}

export async function deleteChampionshipAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = deleteChampionshipSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Campeonato invalido.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const championshipId = parsedInput.data.championshipId;

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const championship = await tx.championship.findUnique({
        select: {
          country: true,
          id: true,
          name: true,
          status: true,
          _count: {
            select: {
              leagues: true,
              seasons: true
            }
          }
        },
        where: {
          id: championshipId
        }
      });

      if (!championship) {
        return null;
      }

      if (championship._count.leagues > 0) {
        return {
          blockedByLeagues: championship._count.leagues
        };
      }

      const scores = await tx.score.deleteMany({
        where: {
          match: {
            round: {
              season: {
                championshipId
              }
            }
          }
        }
      });
      const guesses = await tx.guess.deleteMany({
        where: {
          match: {
            round: {
              season: {
                championshipId
              }
            }
          }
        }
      });
      const rankings = await tx.ranking.deleteMany({
        where: {
          OR: [
            {
              season: {
                championshipId
              }
            },
            {
              round: {
                season: {
                  championshipId
                }
              }
            }
          ]
        }
      });
      const matches = await tx.match.deleteMany({
        where: {
          round: {
            season: {
              championshipId
            }
          }
        }
      });
      const rounds = await tx.round.deleteMany({
        where: {
          season: {
            championshipId
          }
        }
      });
      const seasons = await tx.season.deleteMany({
        where: {
          championshipId
        }
      });
      await tx.championship.delete({
        where: {
          id: championshipId
        }
      });

      const summary = {
        championship: 1,
        guesses: guesses.count,
        matches: matches.count,
        rankings: rankings.count,
        rounds: rounds.count,
        scores: scores.count,
        seasons: seasons.count
      };

      await tx.auditLog.create({
        data: {
          action: "admin.championship.deleted",
          entity: "Championship",
          entityId: championship.id,
          oldValue: JSON.parse(JSON.stringify(championship)),
          newValue: summary,
          userId: admin.id
        }
      });

      return summary;
    });

    if (!deleted) {
      return {
        ok: false,
        message: "Campeonato nao encontrado."
      };
    }

    if ("blockedByLeagues" in deleted) {
      return {
        ok: false,
        message: `Nao exclua este campeonato enquanto houver ${deleted.blockedByLeagues} liga(s) vinculada(s).`
      };
    }

    revalidateAdminPaths();

    return {
      ok: true,
      message: `Campeonato excluido. ${deleted.rounds} rodadas e ${deleted.matches} partidas removidas.`
    };
  } catch {
    return {
      ok: false,
      message: "Nao foi possivel excluir o campeonato."
    };
  }
}

export async function createTeamAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = createTeamSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise os dados da equipe.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const data = parsedInput.data;
  const parsedApiId = typeof data.apiId === "number" ? data.apiId : null;
  const existingByApiId = parsedApiId
    ? await prisma.team.findUnique({
        select: {
          id: true,
          name: true
        },
        where: {
          apiId: parsedApiId
        }
      })
    : null;

  if (existingByApiId) {
    return {
      ok: true,
      message: `Equipe ${existingByApiId.name} ja estava cadastrada.`
    };
  }

  const existingTeam = await prisma.team.findFirst({
    where: {
      country: data.country,
      name: data.name
    },
    select: {
      id: true
    }
  });

  if (existingTeam) {
    return {
      ok: false,
      message: "Esta equipe ja esta cadastrada."
    };
  }

  const team = await prisma.team.create({
    data: {
      apiId: parsedApiId,
      country: data.country,
      logo: data.logo || null,
      name: data.name,
      shortName: data.shortName || null
    },
    select: {
      id: true,
      name: true
    }
  });

  await createAuditLog(admin.id, "admin.team.created", "Team", team.id, undefined, team);
  revalidateAdminPaths();

  return {
    ok: true,
    message: "Equipe cadastrada."
  };
}

export async function bulkImportTeamsAction(formData: FormData): Promise<AdminActionResult> {
  try {
    const admin = await requireAdmin();
    const parsedInput = bulkImportTeamsSchema.safeParse(formDataToObject(formData));

    if (!parsedInput.success) {
      return {
        ok: false,
        message: "Revise a lista de equipes.",
        fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
      };
    }

    const parsedTeams = parseBulkTeamLines(parsedInput.data.teams);
    const summary = await importTeamsIntoDatabase(
      admin.id,
      "bulk",
      parsedTeams.teams,
      parsedTeams.invalid
    );

    if (summary.created + summary.updated === 0) {
      return {
        ok: false,
        message: "Nenhuma equipe valida foi importada."
      };
    }

    return {
      ok: true,
      message: getTeamImportMessage(summary)
    };
  } catch {
    return {
      ok: false,
      message: "Nao foi possivel importar os times em lote."
    };
  }
}

export async function importTeamPresetAction(formData: FormData): Promise<AdminActionResult> {
  try {
    const admin = await requireAdmin();
    const parsedInput = importTeamPresetSchema.safeParse(formDataToObject(formData));

    if (!parsedInput.success) {
      return {
        ok: false,
        message: "Biblioteca de equipes invalida.",
        fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
      };
    }

    const teams = getTeamPreset(parsedInput.data.preset);
    const summary = await importTeamsIntoDatabase(admin.id, parsedInput.data.preset, teams);

    return {
      ok: true,
      message: getTeamImportMessage(summary)
    };
  } catch {
    return {
      ok: false,
      message: "Nao foi possivel importar a biblioteca de times."
    };
  }
}

export async function importApiFootballTeamsAction(formData: FormData): Promise<AdminActionResult> {
  try {
    const admin = await requireAdmin();
    const parsedInput = importApiFootballTeamsSchema.safeParse(formDataToObject(formData));

    if (!parsedInput.success) {
      return {
        ok: false,
        message: "Revise os parametros da API.",
        fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
      };
    }

    const data = parsedInput.data;
    const apiResult = await fetchApiFootballTeams({
      country: typeof data.country === "string" && data.country ? data.country : undefined,
      leagueId: typeof data.leagueId === "number" ? data.leagueId : undefined,
      season: typeof data.season === "number" ? data.season : undefined
    });

    if (!apiResult.ok) {
      return {
        ok: false,
        message: apiResult.message
      };
    }

    if (apiResult.teams.length === 0) {
      return {
        ok: false,
        message: "A API nao retornou equipes para estes parametros."
      };
    }

    const summary = await importTeamsIntoDatabase(admin.id, "api-football", apiResult.teams);

    return {
      ok: true,
      message: getTeamImportMessage(summary)
    };
  } catch {
    return {
      ok: false,
      message: "Nao foi possivel importar os times da API."
    };
  }
}

export async function syncFootballCompetitionAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = syncFootballCompetitionSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Competicao invalida.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const config = getFootballCompetitionConfig(parsedInput.data.competitionKey);

  if (!config) {
    return {
      ok: false,
      message: "Competicao nao configurada."
    };
  }

  const result = await syncFootballCompetition(config, {
    force: parsedInput.data.force === true
  });

  await createAuditLog(
    admin.id,
    result.ok ? "admin.football.sync.completed" : "admin.football.sync.failed",
    "FootballSync",
    config.key,
    undefined,
    {
      message: result.message,
      summary: result.summary
    }
  );
  revalidateAdminPaths();

  return {
    ok: result.ok,
    message: result.message
  };
}

export async function syncAllFootballCompetitionsAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = syncAllFootballCompetitionsSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Parametros invalidos.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const results = [];

  for (const config of footballCompetitionConfigs) {
    const result = await syncFootballCompetition(config, {
      force: parsedInput.data.force === true
    });
    results.push({
      key: config.key,
      message: result.message,
      ok: result.ok,
      summary: result.summary
    });
  }

  const failed = results.filter((result) => !result.ok);

  await createAuditLog(
    admin.id,
    failed.length > 0 ? "admin.football.sync_all.partial" : "admin.football.sync_all.completed",
    "FootballSync",
    "all",
    undefined,
    {
      failed: failed.length,
      results,
      total: results.length
    }
  );
  revalidateAdminPaths();

  return {
    ok: failed.length === 0,
    message:
      failed.length === 0
        ? "Todas as competicoes foram sincronizadas ou respeitaram o cache."
        : `${failed.length} competicao(oes) falharam na sincronizacao.`
  };
}

export async function syncFootballCompetitionScoresAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = syncFootballCompetitionScoresSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Competicao invalida.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const config = getFootballCompetitionConfig(parsedInput.data.competitionKey);

  if (!config) {
    return {
      ok: false,
      message: "Competicao nao configurada."
    };
  }

  const result = await syncFootballCompetitionScores(config);

  await createAuditLog(
    admin.id,
    result.ok ? "admin.football.scores.completed" : "admin.football.scores.failed",
    "FootballScoreSync",
    config.key,
    undefined,
    {
      message: result.message,
      summary: result.summary
    }
  );
  revalidateAdminPaths();

  return {
    ok: result.ok,
    message: result.message
  };
}

export async function syncAllFootballCompetitionScoresAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = syncAllFootballCompetitionScoresSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Parametros invalidos.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const results = [];

  for (const config of footballCompetitionConfigs) {
    const result = await syncFootballCompetitionScores(config);
    results.push({
      key: config.key,
      message: result.message,
      ok: result.ok,
      summary: result.summary
    });
  }

  const failed = results.filter((result) => !result.ok);

  await createAuditLog(
    admin.id,
    failed.length > 0 ? "admin.football.scores_all.partial" : "admin.football.scores_all.completed",
    "FootballScoreSync",
    "all",
    undefined,
    {
      failed: failed.length,
      results,
      total: results.length
    }
  );
  revalidateAdminPaths();

  return {
    ok: failed.length === 0,
    message:
      failed.length === 0
        ? "Placares das competicoes configuradas foram atualizados."
        : `${failed.length} competicao(oes) falharam ao atualizar placares.`
  };
}

export async function createRoundAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = createRoundSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise os dados da rodada.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const data = parsedInput.data;
  const season = await prisma.season.findUnique({
    select: {
      championshipId: true,
      id: true
    },
    where: {
      id: data.seasonId
    }
  });
  const league = data.leagueId
    ? await prisma.league.findFirst({
        select: {
          championshipId: true,
          id: true
        },
        where: {
          deletedAt: null,
          id: data.leagueId
        }
      })
    : null;

  if (!season) {
    return {
      ok: false,
      message: "Temporada nao encontrada."
    };
  }

  if (data.leagueId && !league) {
    return {
      ok: false,
      message: "Liga nao encontrada."
    };
  }

  if (league && league.championshipId !== season.championshipId) {
    return {
      ok: false,
      message: "A liga selecionada pertence a outro campeonato."
    };
  }

  const existingRound = await prisma.round.findFirst({
    select: {
      id: true,
      number: true
    },
    where: {
      leagueId: data.leagueId || null,
      number: data.number,
      seasonId: data.seasonId
    }
  });

  if (existingRound) {
    return {
      ok: true,
      message: `Rodada ${existingRound.number} ja estava cadastrada.`
    };
  }

  const round = await prisma.round.create({
    data: {
      description: data.description || null,
      endsAt: data.endsAt,
      leagueId: data.leagueId || null,
      name: data.name || null,
      number: data.number,
      seasonId: data.seasonId,
      startsAt: data.startsAt,
      status: data.status
    },
    select: {
      id: true,
      number: true,
      status: true
    }
  });

  await createAuditLog(admin.id, "admin.round.created", "Round", round.id, undefined, round);
  revalidateAdminPaths();

  return {
    ok: true,
    message: "Rodada cadastrada."
  };
}

export async function updateRoundStatusAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = updateRoundStatusSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Dados invalidos.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const currentRound = await prisma.round.findUnique({
    select: {
      id: true,
      status: true
    },
    where: {
      id: parsedInput.data.roundId
    }
  });

  if (!currentRound) {
    return {
      ok: false,
      message: "Rodada nao encontrada."
    };
  }

  const round = await prisma.round.update({
    data: {
      status: parsedInput.data.status
    },
    select: {
      id: true,
      status: true
    },
    where: {
      id: currentRound.id
    }
  });

  await createAuditLog(
    admin.id,
    "admin.round.status_updated",
    "Round",
    round.id,
    currentRound,
    round
  );
  revalidateAdminPaths();

  return {
    ok: true,
    message: "Status da rodada atualizado."
  };
}

export async function openRoundAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = openRoundSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Rodada invalida.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const currentRound = await prisma.round.findUnique({
    select: {
      endsAt: true,
      id: true,
      startsAt: true,
      status: true
    },
    where: {
      id: parsedInput.data.roundId
    }
  });

  if (!currentRound) {
    return {
      ok: false,
      message: "Rodada nao encontrada."
    };
  }

  const now = serverNow();
  const fallbackEnd = new Date(now.getTime() + 7 * 86_400_000);

  const round = await prisma.round.update({
    data: {
      endsAt: currentRound.endsAt <= now ? fallbackEnd : currentRound.endsAt,
      startsAt: currentRound.startsAt > now ? now : currentRound.startsAt,
      status: "OPEN"
    },
    select: {
      endsAt: true,
      id: true,
      startsAt: true,
      status: true
    },
    where: {
      id: currentRound.id
    }
  });

  await createAuditLog(admin.id, "admin.round.opened", "Round", round.id, currentRound, round);
  revalidateAdminPaths();

  return {
    ok: true,
    message: "Rodada aberta para palpites."
  };
}

export async function deleteRoundAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = deleteRoundSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Rodada invalida.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const roundId = parsedInput.data.roundId;

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const round = await tx.round.findUnique({
        select: {
          id: true,
          name: true,
          number: true,
          status: true,
          league: {
            select: {
              id: true,
              name: true
            }
          },
          season: {
            select: {
              championship: {
                select: {
                  id: true,
                  name: true
                }
              },
              id: true,
              name: true,
              year: true
            }
          },
          _count: {
            select: {
              matches: true,
              rankings: true
            }
          }
        },
        where: {
          id: roundId
        }
      });

      if (!round) {
        return null;
      }

      const scores = await tx.score.deleteMany({
        where: {
          match: {
            roundId
          }
        }
      });
      const guesses = await tx.guess.deleteMany({
        where: {
          match: {
            roundId
          }
        }
      });
      const rankings = await tx.ranking.deleteMany({
        where: {
          roundId
        }
      });
      const matches = await tx.match.deleteMany({
        where: {
          roundId
        }
      });
      await tx.round.delete({
        where: {
          id: roundId
        }
      });

      const summary = {
        guesses: guesses.count,
        matches: matches.count,
        rankings: rankings.count,
        round: 1,
        scores: scores.count
      };

      await tx.auditLog.create({
        data: {
          action: "admin.round.deleted",
          entity: "Round",
          entityId: round.id,
          oldValue: JSON.parse(JSON.stringify(round)),
          newValue: summary,
          userId: admin.id
        }
      });

      return summary;
    });

    if (!deleted) {
      return {
        ok: false,
        message: "Rodada nao encontrada."
      };
    }

    revalidateAdminPaths();

    return {
      ok: true,
      message: `Rodada excluida. ${deleted.matches} partidas removidas.`
    };
  } catch {
    return {
      ok: false,
      message: "Nao foi possivel excluir a rodada."
    };
  }
}

export async function createMatchAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = createMatchSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise os dados da partida.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const data = parsedInput.data;
  const [round, homeTeam, awayTeam] = await prisma.$transaction([
    prisma.round.findUnique({
      select: {
        id: true,
        league: {
          select: {
            championshipId: true
          }
        },
        season: {
          select: {
            championshipId: true
          }
        }
      },
      where: {
        id: data.roundId
      }
    }),
    prisma.team.findUnique({
      select: {
        id: true
      },
      where: {
        id: data.homeTeamId
      }
    }),
    prisma.team.findUnique({
      select: {
        id: true
      },
      where: {
        id: data.awayTeamId
      }
    })
  ]);

  if (!round || !homeTeam || !awayTeam) {
    return {
      ok: false,
      message: "Rodada ou equipe nao encontrada."
    };
  }

  if (round.league && round.league.championshipId !== round.season.championshipId) {
    return {
      ok: false,
      message: "A rodada pertence a um campeonato diferente da liga."
    };
  }

  const existingMatch = await prisma.match.findFirst({
    select: {
      id: true
    },
    where: {
      awayTeamId: data.awayTeamId,
      deletedAt: null,
      homeTeamId: data.homeTeamId,
      kickoff: data.kickoff,
      roundId: data.roundId
    }
  });

  if (existingMatch) {
    return {
      ok: true,
      message: "Partida ja estava cadastrada."
    };
  }

  const match = await prisma.match.create({
    data: {
      awayTeamId: data.awayTeamId,
      broadcast: data.broadcast || null,
      city: data.city || null,
      country: data.country || null,
      homeTeamId: data.homeTeamId,
      kickoff: data.kickoff,
      referee: data.referee || null,
      roundId: data.roundId,
      stadium: data.stadium || null,
      status: data.status
    },
    select: {
      id: true,
      kickoff: true,
      status: true
    }
  });

  await createAuditLog(admin.id, "admin.match.created", "Match", match.id, undefined, match);
  revalidateAdminPaths();

  return {
    ok: true,
    message: "Partida cadastrada."
  };
}

export async function updateMatchStatusAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = updateMatchStatusSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Dados invalidos.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const currentMatch = await prisma.match.findUnique({
    select: {
      id: true,
      status: true
    },
    where: {
      id: parsedInput.data.matchId
    }
  });

  if (!currentMatch) {
    return {
      ok: false,
      message: "Partida nao encontrada."
    };
  }

  const match = await prisma.match.update({
    data: {
      status: parsedInput.data.status
    },
    select: {
      id: true,
      status: true
    },
    where: {
      id: currentMatch.id
    }
  });

  await createAuditLog(
    admin.id,
    "admin.match.status_updated",
    "Match",
    match.id,
    currentMatch,
    match
  );
  revalidateAdminPaths();

  return {
    ok: true,
    message: "Status da partida atualizado."
  };
}

export async function homologateMatchResultAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = homologateMatchResultSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise o placar oficial.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const data = parsedInput.data;
  const currentMatch = await prisma.match.findUnique({
    select: {
      awayScore: true,
      deletedAt: true,
      homeScore: true,
      homologatedAt: true,
      id: true,
      status: true
    },
    where: {
      id: data.matchId
    }
  });

  if (!currentMatch || currentMatch.deletedAt) {
    return {
      ok: false,
      message: "Partida nao encontrada."
    };
  }

  if (currentMatch.status === "CANCELLED") {
    return {
      ok: false,
      message: "Partidas canceladas nao podem ser homologadas."
    };
  }

  const match = await prisma.match.update({
    data: {
      awayScore: data.awayScore,
      homeScore: data.homeScore,
      homologatedAt: serverNow(),
      status: "FINISHED"
    },
    select: {
      awayScore: true,
      homeScore: true,
      homologatedAt: true,
      id: true,
      status: true
    },
    where: {
      id: currentMatch.id
    }
  });

  const scoringSummary = await processMatchScores(match.id);
  const xpSummary = await grantMatchResultXp(match.id);
  const rankingSummary = await recalculateRankingsForMatch(match.id);

  await createAuditLog(
    admin.id,
    currentMatch.homologatedAt ? "admin.match.result_rectified" : "admin.match.result_homologated",
    "Match",
    match.id,
    currentMatch,
    {
      match,
      rankingSummary,
      scoringSummary,
      xpSummary
    }
  );
  revalidateAdminPaths();

  return {
    ok: true,
    message: `Resultado homologado. ${scoringSummary.processedGuesses} palpites, ${rankingSummary.leagueRows} posicoes de liga e ${xpSummary.resultHitEvents + xpSummary.exactScoreEvents} eventos de XP processados.`
  };
}

export async function updateLeagueStatusAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = updateLeagueStatusSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Dados invalidos.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const league = await prisma.league.update({
    where: {
      id: parsedInput.data.leagueId
    },
    data: {
      status: parsedInput.data.status
    },
    select: {
      id: true,
      status: true
    }
  });

  await createAuditLog(
    admin.id,
    "admin.league.status_updated",
    "League",
    league.id,
    undefined,
    league
  );
  revalidateAdminPaths();

  return {
    ok: true,
    message: "Status da liga atualizado."
  };
}

export async function updateLeagueChampionshipAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = updateLeagueChampionshipSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Dados invalidos.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const [league, championship, incompatibleRound] = await prisma.$transaction([
    prisma.league.findFirst({
      select: {
        championshipId: true,
        id: true,
        name: true
      },
      where: {
        deletedAt: null,
        id: parsedInput.data.leagueId
      }
    }),
    prisma.championship.findFirst({
      select: {
        id: true,
        name: true
      },
      where: {
        deletedAt: null,
        id: parsedInput.data.championshipId,
        status: "ACTIVE"
      }
    }),
    prisma.round.findFirst({
      select: {
        id: true,
        name: true,
        number: true,
        season: {
          select: {
            championship: {
              select: {
                name: true
              }
            },
            championshipId: true
          }
        }
      },
      where: {
        leagueId: parsedInput.data.leagueId,
        season: {
          championshipId: {
            not: parsedInput.data.championshipId
          }
        }
      }
    })
  ]);

  if (!league) {
    return {
      ok: false,
      message: "Liga nao encontrada."
    };
  }

  if (!championship) {
    return {
      ok: false,
      message: "Campeonato ativo nao encontrado."
    };
  }

  if (incompatibleRound) {
    return {
      ok: false,
      message: `Nao foi possivel trocar: a ${incompatibleRound.name || `Rodada ${incompatibleRound.number}`} pertence ao campeonato ${incompatibleRound.season.championship.name}.`
    };
  }

  const updatedLeague = await prisma.league.update({
    data: {
      championshipId: championship.id
    },
    select: {
      championshipId: true,
      id: true,
      name: true
    },
    where: {
      id: league.id
    }
  });

  await createAuditLog(
    admin.id,
    "admin.league.championship_updated",
    "League",
    updatedLeague.id,
    league,
    {
      ...updatedLeague,
      championshipName: championship.name
    }
  );
  revalidateAdminPaths();

  return {
    ok: true,
    message: "Campeonato da liga atualizado."
  };
}

export async function adjustLeagueRankingAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = adjustLeagueRankingSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise o ajuste do ranking.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const data = parsedInput.data;
  const [league, membership] = await prisma.$transaction([
    prisma.league.findFirst({
      select: {
        id: true,
        name: true
      },
      where: {
        deletedAt: null,
        id: data.leagueId
      }
    }),
    prisma.leagueMember.findUnique({
      select: {
        status: true,
        user: {
          select: {
            email: true,
            id: true,
            name: true
          }
        }
      },
      where: {
        leagueId_userId: {
          leagueId: data.leagueId,
          userId: data.userId
        }
      }
    })
  ]);

  if (!league) {
    return {
      ok: false,
      message: "Liga nao encontrada."
    };
  }

  if (!membership || membership.status !== "ACTIVE") {
    return {
      ok: false,
      message: "Participante ativo nao encontrado nesta liga."
    };
  }

  const adjustment = await prisma.rankingAdjustment.create({
    data: {
      adminId: admin.id,
      leagueId: league.id,
      pointsDelta: data.pointsDelta,
      reason: data.reason,
      userId: membership.user.id
    },
    select: {
      id: true,
      pointsDelta: true,
      reason: true
    }
  });
  const rows = await recalculateLeagueRanking(league.id);

  await createAuditLog(
    admin.id,
    "admin.league.ranking_adjusted",
    "RankingAdjustment",
    adjustment.id,
    undefined,
    {
      leagueId: league.id,
      leagueName: league.name,
      pointsDelta: adjustment.pointsDelta,
      reason: adjustment.reason,
      rows,
      userEmail: membership.user.email,
      userId: membership.user.id,
      userName: membership.user.name
    }
  );
  revalidateAdminPaths();

  return {
    ok: true,
    message: `Ajuste de ${data.pointsDelta} ponto(s) aplicado para ${membership.user.name}.`
  };
}

export async function recalculateLeagueRankingAction(
  formData: FormData
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = recalculateLeagueRankingSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Liga invalida.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const league = await prisma.league.findFirst({
    select: {
      id: true,
      name: true
    },
    where: {
      deletedAt: null,
      id: parsedInput.data.leagueId
    }
  });

  if (!league) {
    return {
      ok: false,
      message: "Liga nao encontrada."
    };
  }

  const matches = await prisma.match.findMany({
    select: {
      id: true
    },
    where: {
      deletedAt: null,
      homeScore: {
        not: null
      },
      awayScore: {
        not: null
      },
      homologatedAt: {
        not: null
      },
      round: {
        leagueId: league.id
      }
    }
  });

  for (const match of matches) {
    await processMatchScores(match.id);
    await grantMatchResultXp(match.id);
  }

  const rows = await recalculateLeagueRanking(league.id);

  await createAuditLog(
    admin.id,
    "admin.league.ranking_recalculated",
    "League",
    league.id,
    undefined,
    {
      leagueId: league.id,
      leagueName: league.name,
      matches: matches.length,
      rows
    }
  );
  revalidateAdminPaths();

  return {
    ok: true,
    message: `Ranking de ${league.name} recalculado com ${rows} posicoes e ${matches.length} partida(s) revisada(s).`
  };
}

export async function deleteLeagueAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = deleteLeagueSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Liga invalida.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const leagueId = parsedInput.data.leagueId;

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const league = await tx.league.findUnique({
        select: {
          id: true,
          inviteCode: true,
          name: true,
          status: true,
          visibility: true,
          _count: {
            select: {
              members: true,
              payments: true,
              rounds: true
            }
          }
        },
        where: {
          id: leagueId
        }
      });

      if (!league) {
        return null;
      }

      const scoreWhere: Prisma.ScoreWhereInput = {
        OR: [
          {
            leagueId
          },
          {
            guess: {
              leagueId
            }
          },
          {
            match: {
              round: {
                leagueId
              }
            }
          }
        ]
      };
      const guessWhere: Prisma.GuessWhereInput = {
        OR: [
          {
            leagueId
          },
          {
            match: {
              round: {
                leagueId
              }
            }
          }
        ]
      };

      const scores = await tx.score.deleteMany({
        where: scoreWhere
      });
      const guesses = await tx.guess.deleteMany({
        where: guessWhere
      });
      const rankings = await tx.ranking.deleteMany({
        where: {
          OR: [
            {
              leagueId
            },
            {
              round: {
                leagueId
              }
            }
          ]
        }
      });
      const payments = await tx.payment.deleteMany({
        where: {
          leagueId
        }
      });
      const members = await tx.leagueMember.deleteMany({
        where: {
          leagueId
        }
      });
      const matches = await tx.match.deleteMany({
        where: {
          round: {
            leagueId
          }
        }
      });
      const rounds = await tx.round.deleteMany({
        where: {
          leagueId
        }
      });
      await tx.league.delete({
        where: {
          id: leagueId
        }
      });

      const summary = {
        guesses: guesses.count,
        league: 1,
        matches: matches.count,
        members: members.count,
        payments: payments.count,
        rankings: rankings.count,
        rounds: rounds.count,
        scores: scores.count
      };

      await tx.auditLog.create({
        data: {
          action: "admin.league.deleted",
          entity: "League",
          entityId: league.id,
          oldValue: JSON.parse(JSON.stringify(league)),
          newValue: summary,
          userId: admin.id
        }
      });

      return summary;
    });

    if (!deleted) {
      return {
        ok: false,
        message: "Liga nao encontrada."
      };
    }

    revalidateAdminPaths();

    return {
      ok: true,
      message: `Liga excluida. ${deleted.rounds} rodadas e ${deleted.members} participantes removidos.`
    };
  } catch {
    return {
      ok: false,
      message: "Nao foi possivel excluir a liga."
    };
  }
}

export async function updateLeagueXpEnabledAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = updateLeagueXpEnabledSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Liga invalida.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const league = await prisma.league.update({
    data: {
      xpEnabled: parsedInput.data.xpEnabled
    },
    select: {
      id: true,
      name: true,
      xpEnabled: true
    },
    where: {
      id: parsedInput.data.leagueId
    }
  });

  await createAuditLog(admin.id, "admin.league.xp_updated", "League", league.id, undefined, league);
  revalidateAdminPaths();

  return {
    ok: true,
    message: `XP ${league.xpEnabled ? "ativado" : "desativado"} para ${league.name}.`
  };
}

export async function createXpLevelAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = createXpLevelSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise o novo nivel.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const data = parsedInput.data;
  const level = await prisma.xpLevel.create({
    data: {
      active: data.active ?? true,
      benefits: {
        benefits:
          data.discountPercent > 0
            ? [`${data.discountPercent}% de desconto em ligas pagas`]
            : ["Patente no perfil"]
      },
      color: data.color,
      discountPercent: data.discountPercent,
      key: data.key,
      maxXp: data.maxXp === "" || data.maxXp === undefined ? null : data.maxXp,
      medal: data.medal,
      minXp: data.minXp,
      name: data.name,
      sortOrder: data.sortOrder
    }
  });

  await createAuditLog(admin.id, "admin.xp.level_created", "XpLevel", level.id, undefined, level);
  revalidateAdminPaths();

  return {
    ok: true,
    message: `Nivel ${level.name} criado.`
  };
}

export async function updateXpLevelAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = updateXpLevelSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise o nivel de XP.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const data = parsedInput.data;
  const level = await prisma.xpLevel.update({
    data: {
      active: data.active ?? false,
      benefits: {
        benefits:
          data.discountPercent > 0
            ? [`${data.discountPercent}% de desconto em ligas pagas`]
            : ["Patente no perfil"]
      },
      color: data.color,
      discountPercent: data.discountPercent,
      maxXp: data.maxXp === "" || data.maxXp === undefined ? null : data.maxXp,
      medal: data.medal,
      minXp: data.minXp,
      name: data.name
    },
    where: {
      id: data.levelId
    }
  });

  await createAuditLog(admin.id, "admin.xp.level_updated", "XpLevel", level.id, undefined, level);
  revalidateAdminPaths();

  return {
    ok: true,
    message: `Nivel ${level.name} atualizado.`
  };
}

export async function createXpTypeConfigAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = createXpTypeConfigSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise a nova fonte de XP.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const data = parsedInput.data;
  const typeConfig = await prisma.xpTypeConfig.create({
    data: {
      active: data.active ?? true,
      amount: data.amount,
      description: data.description || null,
      key: data.key,
      label: data.label
    }
  });

  await createAuditLog(
    admin.id,
    "admin.xp.type_created",
    "XpTypeConfig",
    typeConfig.id,
    undefined,
    typeConfig
  );
  revalidateAdminPaths();

  return {
    ok: true,
    message: `Fonte ${typeConfig.label} criada.`
  };
}

export async function updateXpTypeConfigAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = updateXpTypeConfigSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise a fonte de XP.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const data = parsedInput.data;
  const typeConfig = await prisma.xpTypeConfig.update({
    data: {
      active: data.active ?? false,
      amount: data.amount
    },
    where: {
      id: data.typeConfigId
    }
  });

  await createAuditLog(
    admin.id,
    "admin.xp.type_updated",
    "XpTypeConfig",
    typeConfig.id,
    undefined,
    typeConfig
  );
  revalidateAdminPaths();

  return {
    ok: true,
    message: `Fonte ${typeConfig.label} atualizada.`
  };
}

export async function createAchievementBadgeAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = createAchievementBadgeSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise a nova conquista.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const badge = await prisma.badge.create({
    data: parsedInput.data
  });

  await createAuditLog(admin.id, "admin.xp.badge_created", "Badge", badge.id, undefined, badge);
  revalidateAdminPaths();

  return {
    ok: true,
    message: `Conquista ${badge.title} criada.`
  };
}

export async function createMissionAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = createMissionSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise a nova missao.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const data = parsedInput.data;
  const mission = await prisma.mission.create({
    data: {
      active: data.active ?? true,
      description: data.description,
      endsAt: data.endsAt,
      key: data.key,
      startsAt: data.startsAt,
      target: data.target,
      title: data.title,
      type: data.type,
      xpReward: data.xpReward
    }
  });

  await createAuditLog(
    admin.id,
    "admin.xp.mission_created",
    "Mission",
    mission.id,
    undefined,
    mission
  );
  revalidateAdminPaths();

  return {
    ok: true,
    message: `Missao ${mission.title} criada.`
  };
}

export async function grantManualXpAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = grantManualXpSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise o ajuste manual de XP.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const user = await prisma.user.findFirst({
    select: {
      email: true,
      id: true,
      name: true
    },
    where: {
      deletedAt: null,
      id: parsedInput.data.userId
    }
  });

  if (!user) {
    return {
      ok: false,
      message: "Usuario nao encontrado."
    };
  }

  const result = await grantManualXp({
    adminId: admin.id,
    amount: parsedInput.data.amount,
    reason: parsedInput.data.reason,
    userId: user.id
  });

  await createAuditLog(admin.id, "admin.xp.manual_adjustment", "User", user.id, undefined, {
    amount: parsedInput.data.amount,
    reason: parsedInput.data.reason,
    userEmail: user.email,
    userName: user.name
  });
  revalidateAdminPaths();

  return {
    ok: true,
    message: result.created
      ? `Ajuste de ${parsedInput.data.amount} XP aplicado para ${user.name}.`
      : "Ajuste de XP ignorado por regra de duplicidade ou fonte inativa."
  };
}

export async function recalculateUserXpAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = recalculateUserXpSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Usuario invalido.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const userId = parsedInput.data.userId;

  if (!userId || userId === "all") {
    const total = await recalculateAllUsersXp();

    await createAuditLog(admin.id, "admin.xp.recalculated_all", "XpEvent", "all", undefined, {
      users: total
    });
    revalidateAdminPaths();

    return {
      ok: true,
      message: `XP recalculado para ${total} usuario(s).`
    };
  }

  const snapshot = await recalculateXpForUser(userId);

  await createAuditLog(admin.id, "admin.xp.recalculated_user", "User", userId, undefined, {
    level: snapshot.level.name,
    xp: snapshot.xp
  });
  revalidateAdminPaths();

  return {
    ok: true,
    message: `XP recalculado: ${snapshot.xp} XP.`
  };
}

export async function updateXpSettingsAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = updateXpSettingsSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise as configuracoes de XP.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const setting = await setPaidLeagueMinimumEntryFee(parsedInput.data.paidLeagueMinimumEntryFee);

  await createAuditLog(admin.id, "admin.xp.settings_updated", "Setting", setting.id, undefined, {
    paidLeagueMinimumEntryFee: parsedInput.data.paidLeagueMinimumEntryFee
  });
  revalidateAdminPaths();

  return {
    ok: true,
    message: "Configuracoes de XP atualizadas."
  };
}

export async function updatePaymentStatusAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = updatePaymentStatusSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Dados invalidos.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const paidAt = parsedInput.data.status === "APPROVED" ? serverNow() : null;

  const payment = await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: {
        id: parsedInput.data.paymentId
      },
      data: {
        status: parsedInput.data.status,
        paidAt
      },
      select: {
        amount: true,
        id: true,
        leagueId: true,
        status: true,
        userId: true
      }
    });

    if (updatedPayment.status === "APPROVED") {
      await tx.leagueMember.upsert({
        create: {
          leagueId: updatedPayment.leagueId,
          role: "MEMBER",
          status: "ACTIVE",
          userId: updatedPayment.userId
        },
        update: {
          joinedAt: serverNow(),
          leftAt: null,
          status: "ACTIVE"
        },
        where: {
          leagueId_userId: {
            leagueId: updatedPayment.leagueId,
            userId: updatedPayment.userId
          }
        }
      });
    }

    return updatedPayment;
  });

  await createAuditLog(admin.id, "admin.payment.status_updated", "Payment", payment.id, undefined, {
    leagueId: payment.leagueId,
    status: payment.status,
    amount: payment.amount.toString(),
    userId: payment.userId
  });

  if (payment.status === "APPROVED") {
    await Promise.all([
      syncActiveLeagueMissionProgress(payment.userId),
      evaluateAchievementsForUser(payment.userId)
    ]);
  }

  revalidateAdminPaths();

  return {
    ok: true,
    message: "Pagamento atualizado."
  };
}

export async function saveGeneralSettingsAction(formData: FormData): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  const parsedInput = generalSettingsSchema.safeParse(formDataToObject(formData));

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise as configuracoes.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const entries = Object.entries(parsedInput.data);

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: {
          key
        },
        update: {
          value
        },
        create: {
          key,
          value
        }
      })
    )
  );

  await createAuditLog(
    admin.id,
    "admin.settings.updated",
    "Setting",
    "general",
    undefined,
    parsedInput.data
  );
  revalidateAdminPaths();

  return {
    ok: true,
    message: "Configuracoes atualizadas."
  };
}
