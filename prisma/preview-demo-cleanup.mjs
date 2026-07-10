import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_INVITE_CODE = "BRLOBO2026";
const DEMO_CHAMPIONSHIP_NAME = "Brasileirao Ficticio 2026";
const shouldApply = process.env.DEMO_CLEANUP_APPLY === "true";
const confirmed = process.env.CONFIRM_DEMO_CLEANUP === DEMO_INVITE_CODE;

async function getTargets() {
  const leagues = await prisma.league.findMany({
    select: {
      id: true,
      inviteCode: true,
      name: true
    },
    where: {
      OR: [{ inviteCode: DEMO_INVITE_CODE }, { name: "Bolao Brasileirao Ficticio" }]
    }
  });
  const championships = await prisma.championship.findMany({
    select: {
      id: true,
      name: true
    },
    where: {
      name: DEMO_CHAMPIONSHIP_NAME
    }
  });
  const leagueIds = leagues.map((league) => league.id);
  const championshipIds = championships.map((championship) => championship.id);
  const seasons = await prisma.season.findMany({
    select: {
      id: true,
      name: true,
      year: true
    },
    where: {
      championshipId: {
        in: championshipIds
      }
    }
  });
  const seasonIds = seasons.map((season) => season.id);
  const rounds = await prisma.round.findMany({
    select: {
      id: true,
      name: true,
      number: true
    },
    where: {
      OR: [
        {
          leagueId: {
            in: leagueIds
          }
        },
        {
          seasonId: {
            in: seasonIds
          }
        }
      ]
    }
  });
  const roundIds = rounds.map((round) => round.id);
  const matches = await prisma.match.findMany({
    select: {
      id: true
    },
    where: {
      roundId: {
        in: roundIds
      }
    }
  });

  return {
    championshipIds,
    championships,
    leagueIds,
    leagues,
    matchIds: matches.map((match) => match.id),
    roundIds,
    rounds,
    seasonIds,
    seasons
  };
}

async function countTargets(targets) {
  const [scores, guesses, rankings, payments, members, matches] = await Promise.all([
    prisma.score.count({
      where: {
        OR: [
          {
            leagueId: {
              in: targets.leagueIds
            }
          },
          {
            matchId: {
              in: targets.matchIds
            }
          }
        ]
      }
    }),
    prisma.guess.count({
      where: {
        OR: [
          {
            leagueId: {
              in: targets.leagueIds
            }
          },
          {
            matchId: {
              in: targets.matchIds
            }
          }
        ]
      }
    }),
    prisma.ranking.count({
      where: {
        OR: [
          {
            leagueId: {
              in: targets.leagueIds
            }
          },
          {
            roundId: {
              in: targets.roundIds
            }
          },
          {
            seasonId: {
              in: targets.seasonIds
            }
          }
        ]
      }
    }),
    prisma.payment.count({
      where: {
        leagueId: {
          in: targets.leagueIds
        }
      }
    }),
    prisma.leagueMember.count({
      where: {
        leagueId: {
          in: targets.leagueIds
        }
      }
    }),
    prisma.match.count({
      where: {
        id: {
          in: targets.matchIds
        }
      }
    })
  ]);

  return {
    championships: targets.championshipIds.length,
    guesses,
    leagues: targets.leagueIds.length,
    matches,
    members,
    payments,
    rankings,
    rounds: targets.roundIds.length,
    scores,
    seasons: targets.seasonIds.length,
    users: 0
  };
}

async function deleteTargets(targets) {
  await prisma.$transaction([
    prisma.score.deleteMany({
      where: {
        OR: [
          {
            leagueId: {
              in: targets.leagueIds
            }
          },
          {
            matchId: {
              in: targets.matchIds
            }
          }
        ]
      }
    }),
    prisma.ranking.deleteMany({
      where: {
        OR: [
          {
            leagueId: {
              in: targets.leagueIds
            }
          },
          {
            roundId: {
              in: targets.roundIds
            }
          },
          {
            seasonId: {
              in: targets.seasonIds
            }
          }
        ]
      }
    }),
    prisma.guess.deleteMany({
      where: {
        OR: [
          {
            leagueId: {
              in: targets.leagueIds
            }
          },
          {
            matchId: {
              in: targets.matchIds
            }
          }
        ]
      }
    }),
    prisma.payment.deleteMany({
      where: {
        leagueId: {
          in: targets.leagueIds
        }
      }
    }),
    prisma.leagueMember.deleteMany({
      where: {
        leagueId: {
          in: targets.leagueIds
        }
      }
    }),
    prisma.match.deleteMany({
      where: {
        id: {
          in: targets.matchIds
        }
      }
    }),
    prisma.round.deleteMany({
      where: {
        id: {
          in: targets.roundIds
        }
      }
    }),
    prisma.league.deleteMany({
      where: {
        id: {
          in: targets.leagueIds
        }
      }
    }),
    prisma.season.deleteMany({
      where: {
        id: {
          in: targets.seasonIds
        }
      }
    }),
    prisma.championship.deleteMany({
      where: {
        id: {
          in: targets.championshipIds
        }
      }
    })
  ]);
}

async function main() {
  const targets = await getTargets();
  const counts = await countTargets(targets);

  console.table(counts);
  console.info("Alvos de liga:", targets.leagues);
  console.info("Alvos de campeonato:", targets.championships);

  if (!shouldApply) {
    console.info(
      `Modo preview. Para aplicar, defina DEMO_CLEANUP_APPLY=true e CONFIRM_DEMO_CLEANUP=${DEMO_INVITE_CODE}.`
    );
    return;
  }

  if (!confirmed) {
    throw new Error(`Confirmacao ausente. Use CONFIRM_DEMO_CLEANUP=${DEMO_INVITE_CODE}.`);
  }

  await deleteTargets(targets);
  console.info("Limpeza demo concluida. Usuarios nao foram removidos.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
