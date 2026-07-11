"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/server/auth/session";
import { getDatabaseErrorCode } from "@/server/db/errors";
import { prisma } from "@/server/db";
import { grantGuessSubmittedXp } from "@/features/xp/services/xp-service";
import { getPointsPreview, getScoringDefaults } from "../data/guess-data";
import {
  deleteGuessSchema,
  upsertGuessSchema,
  type DeleteGuessInput,
  type UpsertGuessInput
} from "../schemas/guess-schemas";
import type { GuessActionResult } from "../types/guess-action-result";

type EditableMatch = {
  deletedAt: Date | null;
  kickoff: Date;
  round: {
    endsAt: Date;
    league: {
      championshipId: string;
    } | null;
    leagueId: string | null;
    season: {
      championshipId: string;
    };
    startsAt: Date;
    status: string;
  };
  status: string;
};

function normalizeFieldErrors(fieldErrors: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => {
      return Array.isArray(entry[1]) && entry[1].length > 0;
    })
  );
}

function validateEditableMatch(match: EditableMatch | null, now = new Date()) {
  if (!match || match.deletedAt) {
    return "Partida nao encontrada.";
  }

  if (match.status !== "SCHEDULED") {
    return "Esta partida nao esta aberta para palpites.";
  }

  if (match.kickoff <= now) {
    return "O prazo para esta partida foi encerrado.";
  }

  if (match.round.status !== "OPEN") {
    return "A rodada desta partida nao esta aberta.";
  }

  if (match.round.startsAt > now || match.round.endsAt < now) {
    return "A rodada nao esta dentro do periodo de envio.";
  }

  if (
    !match.round.league ||
    match.round.league.championshipId !== match.round.season.championshipId
  ) {
    return "Esta partida nao pertence ao campeonato da liga.";
  }

  return null;
}

function revalidateGuessesArea() {
  revalidatePath("/admin/palpites");
  revalidatePath("/comparar-palpites");
  revalidatePath("/palpites");
  revalidatePath("/dashboard");
  revalidatePath("/estatisticas");
  revalidatePath("/perfil");
  revalidatePath("/xp-ranking");
  revalidatePath("/ligas");
  revalidatePath("/minhas-ligas");
  revalidatePath("/ranking");
  revalidatePath("/rodadas");
}

async function createGuessAuditLog(
  userId: string,
  action: string,
  entityId: string,
  oldValue?: unknown,
  newValue?: unknown
) {
  await prisma.auditLog.create({
    data: {
      action,
      entity: "Guess",
      entityId,
      newValue: newValue === undefined ? undefined : JSON.parse(JSON.stringify(newValue)),
      oldValue: oldValue === undefined ? undefined : JSON.parse(JSON.stringify(oldValue)),
      userId
    }
  });
}

export async function upsertGuessAction(
  input: UpsertGuessInput
): Promise<GuessActionResult<{ pointsPreview: number }>> {
  const sessionUser = await requireUser();
  const parsedInput = upsertGuessSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise os dados do palpite.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const data = parsedInput.data;

  try {
    const match = await prisma.match.findUnique({
      select: {
        deletedAt: true,
        kickoff: true,
        round: {
          select: {
            endsAt: true,
            league: {
              select: {
                championshipId: true
              }
            },
            leagueId: true,
            season: {
              select: {
                championshipId: true
              }
            },
            startsAt: true,
            status: true
          }
        },
        roundId: true,
        status: true
      },
      where: {
        id: data.matchId
      }
    });

    const matchError = validateEditableMatch(match);

    if (matchError || !match) {
      return {
        ok: false,
        message: matchError ?? "Partida nao encontrada."
      };
    }

    if (!match.round.leagueId) {
      return {
        ok: false,
        message: "Esta partida nao esta vinculada a uma liga."
      };
    }

    const membership = await prisma.leagueMember.findUnique({
      select: {
        id: true,
        status: true
      },
      where: {
        leagueId_userId: {
          leagueId: match.round.leagueId,
          userId: sessionUser.id
        }
      }
    });

    if (!membership || membership.status !== "ACTIVE") {
      return {
        ok: false,
        message: "Voce precisa participar desta liga para palpitar."
      };
    }

    const scoring = await getScoringDefaults();

    if (data.joker) {
      const jokersInRound = await prisma.guess.count({
        where: {
          deletedAt: null,
          joker: true,
          match: {
            roundId: match.roundId
          },
          leagueId: match.round.leagueId,
          matchId: {
            not: data.matchId
          },
          userId: sessionUser.id
        }
      });

      if (jokersInRound >= scoring.jokerLimitPerRound) {
        return {
          ok: false,
          message: "Voce ja utilizou o curinga desta rodada.",
          fieldErrors: {
            joker: ["Voce ja utilizou o curinga desta rodada."]
          }
        };
      }
    }

    const currentGuess = await prisma.guess.findUnique({
      select: {
        awayPrediction: true,
        deletedAt: true,
        homePrediction: true,
        id: true,
        joker: true,
        leagueId: true,
        prediction: true
      },
      where: {
        userId_leagueId_matchId: {
          leagueId: match.round.leagueId,
          matchId: data.matchId,
          userId: sessionUser.id
        }
      }
    });

    const guess = await prisma.guess.upsert({
      create: {
        awayPrediction: data.awayPrediction,
        homePrediction: data.homePrediction,
        joker: data.joker,
        leagueId: match.round.leagueId,
        matchId: data.matchId,
        prediction: data.prediction,
        userId: sessionUser.id
      },
      update: {
        awayPrediction: data.awayPrediction,
        deletedAt: null,
        homePrediction: data.homePrediction,
        joker: data.joker,
        leagueId: match.round.leagueId,
        prediction: data.prediction,
        submittedAt: currentGuess?.deletedAt ? new Date() : undefined
      },
      where: {
        userId_leagueId_matchId: {
          leagueId: match.round.leagueId,
          matchId: data.matchId,
          userId: sessionUser.id
        }
      }
    });

    await createGuessAuditLog(
      sessionUser.id,
      currentGuess?.deletedAt || !currentGuess ? "guess.created" : "guess.updated",
      guess.id,
      currentGuess,
      {
        awayPrediction: data.awayPrediction,
        homePrediction: data.homePrediction,
        joker: data.joker,
        leagueId: match.round.leagueId,
        matchId: data.matchId,
        prediction: data.prediction
      }
    );

    await grantGuessSubmittedXp(guess.id);
    revalidateGuessesArea();

    return {
      ok: true,
      message:
        currentGuess?.deletedAt || !currentGuess ? "Palpite enviado." : "Palpite atualizado.",
      data: {
        pointsPreview: getPointsPreview(scoring, data.joker)
      }
    };
  } catch (error) {
    const errorCode = getDatabaseErrorCode(error);

    if (errorCode === "UNIQUE_CONSTRAINT") {
      return {
        ok: false,
        message: "Ja existe um palpite para esta partida."
      };
    }

    return {
      ok: false,
      message: "Nao foi possivel salvar o palpite."
    };
  }
}

export async function deleteGuessAction(input: DeleteGuessInput): Promise<GuessActionResult> {
  const sessionUser = await requireUser();
  const parsedInput = deleteGuessSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Palpite invalido.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  try {
    const guess = await prisma.guess.findFirst({
      include: {
        match: {
          select: {
            deletedAt: true,
            kickoff: true,
            round: {
              select: {
                endsAt: true,
                league: {
                  select: {
                    championshipId: true
                  }
                },
                leagueId: true,
                season: {
                  select: {
                    championshipId: true
                  }
                },
                startsAt: true,
                status: true
              }
            },
            status: true
          }
        }
      },
      where: {
        deletedAt: null,
        id: parsedInput.data.guessId,
        userId: sessionUser.id
      }
    });

    if (!guess) {
      return {
        ok: false,
        message: "Palpite nao encontrado."
      };
    }

    const matchError = validateEditableMatch(guess.match);

    if (matchError) {
      return {
        ok: false,
        message: matchError
      };
    }

    if (!guess.match.round.leagueId) {
      return {
        ok: false,
        message: "Esta partida nao esta vinculada a uma liga."
      };
    }

    const membership = await prisma.leagueMember.findUnique({
      select: {
        id: true,
        status: true
      },
      where: {
        leagueId_userId: {
          leagueId: guess.match.round.leagueId,
          userId: sessionUser.id
        }
      }
    });

    if (!membership || membership.status !== "ACTIVE") {
      return {
        ok: false,
        message: "Voce precisa participar desta liga para alterar este palpite."
      };
    }

    await prisma.guess.update({
      data: {
        deletedAt: new Date(),
        joker: false
      },
      where: {
        id: guess.id
      }
    });

    await createGuessAuditLog(sessionUser.id, "guess.deleted", guess.id, guess);
    revalidateGuessesArea();

    return {
      ok: true,
      message: "Palpite excluido."
    };
  } catch {
    return {
      ok: false,
      message: "Nao foi possivel excluir o palpite."
    };
  }
}
