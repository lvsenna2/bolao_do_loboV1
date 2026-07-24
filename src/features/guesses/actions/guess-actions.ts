"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/server/auth/session";
import { getDatabaseErrorCode } from "@/server/db/errors";
import { prisma } from "@/server/db";
import { grantGuessSubmittedXp } from "@/features/xp/services/xp-service";
import { serverNow } from "@/lib/date-time";
import { getPointsPreview, getScoringDefaults } from "../data/guess-data";
import { isMatchAcceptingGuesses, isRoundAcceptingGuesses } from "../guess-availability";
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

function validateEditableMatch(match: EditableMatch | null, now = serverNow()) {
  if (!match || match.deletedAt) {
    return "Partida nao encontrada.";
  }

  if (!isMatchAcceptingGuesses(match.status, match.kickoff, now)) {
    return match.kickoff <= now
      ? "O prazo para esta partida foi encerrado."
      : "Esta partida nao esta aberta para palpites.";
  }

  if (match.round.status !== "OPEN") {
    return "A rodada desta partida nao esta aberta.";
  }

  if (!isRoundAcceptingGuesses(match.round.status, match.round.endsAt, now)) {
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
): Promise<
  GuessActionResult<{
    guess: {
      awayPrediction: number | null;
      homePrediction: number | null;
      id: string;
      joker: boolean;
      leagueId: string | null;
      prediction: "HOME" | "DRAW" | "AWAY";
      score: null;
      submittedAt: string;
      updatedAt: string;
    };
    pointsPreview: number;
  }>
> {
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
    const leagueId = match.round.leagueId;

    const membership = await prisma.leagueMember.findUnique({
      select: {
        id: true,
        status: true
      },
      where: {
        leagueId_userId: {
          leagueId,
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

    if (data.joker && scoring.jokerLimitPerRound < 1) {
      return {
        ok: false,
        message: "O coringa esta desativado para esta rodada.",
        fieldErrors: {
          joker: ["O coringa esta desativado para esta rodada."]
        }
      };
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
          leagueId,
          matchId: data.matchId,
          userId: sessionUser.id
        }
      }
    });
    const previousJoker = data.joker
      ? await prisma.guess.findFirst({
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
            joker: true,
            leagueId,
            match: {
              roundId: match.roundId
            },
            matchId: {
              not: data.matchId
            },
            userId: sessionUser.id
          }
        })
      : null;

    if (previousJoker && validateEditableMatch(previousJoker.match)) {
      return {
        ok: false,
        message: "O coringa atual ja esta bloqueado e nao pode ser transferido.",
        fieldErrors: {
          joker: ["O coringa atual ja esta bloqueado e nao pode ser transferido."]
        }
      };
    }

    const guess = await prisma.$transaction(
      async (transaction) => {
        if (data.joker) {
          await transaction.guess.updateMany({
            data: {
              joker: false
            },
            where: {
              deletedAt: null,
              joker: true,
              leagueId,
              match: {
                roundId: match.roundId
              },
              matchId: {
                not: data.matchId
              },
              userId: sessionUser.id
            }
          });
        }

        return transaction.guess.upsert({
          create: {
            awayPrediction: data.awayPrediction,
            homePrediction: data.homePrediction,
            joker: data.joker,
            leagueId,
            matchId: data.matchId,
            prediction: data.prediction,
            userId: sessionUser.id
          },
          update: {
            awayPrediction: data.awayPrediction,
            deletedAt: null,
            homePrediction: data.homePrediction,
            joker: data.joker,
            leagueId,
            prediction: data.prediction,
            submittedAt: currentGuess?.deletedAt ? serverNow() : undefined
          },
          where: {
            userId_leagueId_matchId: {
              leagueId,
              matchId: data.matchId,
              userId: sessionUser.id
            }
          }
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );

    if (previousJoker) {
      await createGuessAuditLog(
        sessionUser.id,
        "guess.joker.transferred",
        previousJoker.id,
        { joker: true },
        {
          joker: false,
          transferredToMatchId: data.matchId
        }
      );
    }

    await createGuessAuditLog(
      sessionUser.id,
      currentGuess?.deletedAt || !currentGuess ? "guess.created" : "guess.updated",
      guess.id,
      currentGuess,
      {
        awayPrediction: data.awayPrediction,
        homePrediction: data.homePrediction,
        joker: data.joker,
        leagueId,
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
        guess: {
          awayPrediction: guess.awayPrediction,
          homePrediction: guess.homePrediction,
          id: guess.id,
          joker: guess.joker,
          leagueId: guess.leagueId,
          prediction: guess.prediction,
          score: null,
          submittedAt: guess.submittedAt.toISOString(),
          updatedAt: guess.updatedAt.toISOString()
        },
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
        deletedAt: serverNow(),
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
