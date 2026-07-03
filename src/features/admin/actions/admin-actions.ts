"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { recalculateRankingsForMatch } from "@/features/ranking/services/ranking-service";
import { processMatchScores } from "@/features/scoring/services/scoring-service";
import { requireAdmin } from "@/server/auth/session";
import { prisma } from "@/server/db";
import {
  createChampionshipSchema,
  createMatchSchema,
  createRoundSchema,
  createTeamSchema,
  deleteChampionshipSchema,
  deleteLeagueSchema,
  deleteRoundSchema,
  generalSettingsSchema,
  homologateMatchResultSchema,
  openRoundSchema,
  softDeleteUserSchema,
  updateChampionshipStatusSchema,
  updateLeagueStatusSchema,
  updateMatchStatusSchema,
  updatePaymentStatusSchema,
  updateRoundStatusSchema,
  updateUserRoleSchema,
  updateUserStatusSchema
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
  revalidatePath("/admin/rodadas");
  revalidatePath("/admin/ligas");
  revalidatePath("/admin/pagamentos");
  revalidatePath("/admin/auditoria");
  revalidatePath("/admin/configuracoes");
  revalidatePath("/rodadas");
  revalidatePath("/palpites");
  revalidatePath("/ranking");
  revalidatePath("/dashboard");
  revalidatePath("/perfil");
  revalidatePath("/estatisticas");
  revalidatePath("/minhas-ligas");
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
      id: true,
      status: true
    }
  });

  if (!currentUser) {
    return {
      ok: false,
      message: "Usuario nao encontrado."
    };
  }

  const deletedAt = parsedInput.data.status === "DELETED" ? new Date() : null;

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: currentUser.id
      },
      data: {
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
          status: currentUser.status
        },
        newValue: {
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

  const user = await prisma.user.update({
    where: {
      id: parsedInput.data.userId
    },
    data: {
      status: "DELETED",
      deletedAt: new Date()
    },
    select: {
      id: true,
      email: true,
      username: true
    }
  });

  await createAuditLog(admin.id, "admin.user.deleted", "User", user.id, undefined, user);
  revalidateAdminPaths();

  return {
    ok: true,
    message: "Usuario removido com soft delete."
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
      apiId: typeof data.apiId === "number" ? data.apiId : null,
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
      id: true
    },
    where: {
      id: data.seasonId
    }
  });
  const league = data.leagueId
    ? await prisma.league.findFirst({
        select: {
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

  const now = new Date();
  const fallbackEnd = new Date(now);
  fallbackEnd.setDate(fallbackEnd.getDate() + 7);

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
        id: true
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
      homologatedAt: new Date(),
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
      scoringSummary
    }
  );
  revalidateAdminPaths();

  return {
    ok: true,
    message: `Resultado homologado. ${scoringSummary.processedGuesses} palpites e ${rankingSummary.globalRows} posicoes globais processadas.`
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

  const paidAt = parsedInput.data.status === "APPROVED" ? new Date() : null;

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
          joinedAt: new Date(),
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
