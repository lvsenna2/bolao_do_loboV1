import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const demoSeedAllowed =
  process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_SEED === "true";

if (!demoSeedAllowed) {
  console.error(
    "Demo seed bloqueado em producao. Defina ALLOW_DEMO_SEED=true somente no ambiente de testes inicial."
  );
  process.exit(1);
}

const adminSeed = {
  email: process.env.SEED_ADMIN_EMAIL || "admin@bolaodolobo.local",
  name: process.env.SEED_ADMIN_NAME || "Administrador",
  password: process.env.SEED_ADMIN_PASSWORD || "Admin@123",
  username: process.env.SEED_ADMIN_USERNAME || "admin"
};

const demoUsers = [
  {
    email: "usuario@bolaodolobo.local",
    name: "Usuario Demo",
    password: "Usuario@123",
    username: "usuario_demo"
  },
  {
    email: "rival@bolaodolobo.local",
    name: "Rival Demo",
    password: "Rival@123",
    username: "rival_demo"
  }
];

const settings = [
  {
    key: "platform",
    value: {
      currency: "BRL",
      locale: "pt-BR",
      name: "Bolao do Lobo",
      timezone: "America/Sao_Paulo"
    }
  },
  {
    key: "scoring.default",
    value: {
      exactScoreBonus: 3,
      jokerLimitPerRound: 1,
      jokerMultiplier: 2,
      winnerHit: 3
    }
  },
  {
    key: "security.rateLimit",
    value: {
      adminPerMinute: 300,
      apiPerMinute: 120,
      loginPerMinute: 10,
      registerPerMinute: 5
    }
  }
];

const badges = [
  {
    description: "Primeiro palpite enviado na plataforma.",
    rarity: "COMMON",
    title: "Estreante"
  },
  {
    description: "Reconhecimento por acertos de placar exato.",
    rarity: "RARE",
    title: "Mestre do Placar"
  },
  {
    description: "Destaque por uso eficiente do curinga.",
    rarity: "EPIC",
    title: "Rei do Curinga"
  },
  {
    description: "Conquista lendaria para desempenho historico.",
    rarity: "LEGENDARY",
    title: "Lenda do Bolao"
  }
];

const fictionalTeams = [
  ["Aurora FC", "AUR", "Rio Grande do Sul"],
  ["Bandeirantes SC", "BAN", "Sao Paulo"],
  ["Cerrado EC", "CER", "Goias"],
  ["Dourado AC", "DOU", "Mato Grosso"],
  ["Estrela Azul", "EAZ", "Minas Gerais"],
  ["Farol do Norte", "FAR", "Para"],
  ["Gaviao Serrano", "GAV", "Santa Catarina"],
  ["Horizonte Clube", "HOR", "Ceara"],
  ["Imperial Verde", "IMP", "Parana"],
  ["Jangada FC", "JAN", "Bahia"],
  ["Litoral SC", "LIT", "Pernambuco"],
  ["Montanha Real", "MON", "Espirito Santo"],
  ["Nacional da Serra", "NAS", "Rio de Janeiro"],
  ["Oeste Rubro", "OES", "Mato Grosso do Sul"],
  ["Pampa Clube", "PAM", "Rio Grande do Sul"],
  ["Quatiara FC", "QUA", "Amazonas"],
  ["Rio Branco Azul", "RBA", "Acre"],
  ["Sol Nascente", "SOL", "Rio Grande do Norte"],
  ["Tropical Ferroviario", "TRO", "Maranhao"],
  ["Uniao Capital", "UNI", "Distrito Federal"]
].map(([name, shortName, country], index) => ({
  apiId: 2026200 + index + 1,
  country,
  name,
  shortName
}));

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function atLocalTime(date, hours, minutes = 0) {
  const nextDate = new Date(date);
  nextDate.setHours(hours, minutes, 0, 0);
  return nextDate;
}

function getOfficialPrediction(homeScore, awayScore) {
  if (homeScore > awayScore) {
    return "HOME";
  }

  if (homeScore < awayScore) {
    return "AWAY";
  }

  return "DRAW";
}

function calculateScore(guess, official) {
  const winnerHit = guess.prediction === getOfficialPrediction(official.homeScore, official.awayScore);
  const exactScore =
    guess.homePrediction === official.homeScore && guess.awayPrediction === official.awayScore;
  const basePoints = winnerHit ? 3 : 0;
  const bonusPoints = exactScore ? 3 : 0;
  const subtotal = basePoints + bonusPoints;
  const totalPoints = guess.joker ? subtotal * 2 : subtotal;

  return {
    basePoints,
    bonusPoints,
    exactScore,
    jokerApplied: guess.joker,
    totalPoints,
    winnerHit
  };
}

function getAverageSubmitSeconds(scores) {
  if (scores.length === 0) {
    return null;
  }

  const totalSeconds = scores.reduce((sum, score) => {
    const seconds = Math.max(
      0,
      Math.round((score.matchKickoff.getTime() - score.submittedAt.getTime()) / 1000)
    );

    return sum + seconds;
  }, 0);

  return Math.round(totalSeconds / scores.length);
}

function buildRankingRows(scores, context) {
  const byUser = scores.reduce((accumulator, score) => {
    const list = accumulator.get(score.userId) ?? [];
    list.push(score);
    accumulator.set(score.userId, list);
    return accumulator;
  }, new Map());

  const rows = Array.from(byUser.entries()).map(([userId, userScores]) => {
    const hits = userScores.filter((score) => score.winnerHit).length;

    return {
      averageSubmitSeconds: getAverageSubmitSeconds(userScores),
      currentStreak: hits > 0 ? hits : 0,
      exactScores: userScores.filter((score) => score.exactScore).length,
      hits,
      leagueId: context.leagueId ?? null,
      losses: Math.max(0, userScores.length - hits),
      points: userScores.reduce((sum, score) => sum + score.totalPoints, 0),
      roundId: context.roundId ?? null,
      scope: context.scope,
      seasonId: context.seasonId ?? null,
      userId,
      wins: hits
    };
  });

  return rows
    .sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }

      if (b.exactScores !== a.exactScores) {
        return b.exactScores - a.exactScores;
      }

      if (b.hits !== a.hits) {
        return b.hits - a.hits;
      }

      return a.userId.localeCompare(b.userId);
    })
    .map((row, index) => ({
      ...row,
      position: index + 1
    }));
}

function generateRoundPairings(teams) {
  const first = teams[0];
  const rotating = teams.slice(1);
  const firstLeg = [];

  for (let roundIndex = 0; roundIndex < teams.length - 1; roundIndex += 1) {
    const arrangement = [first, ...rotating];
    const pairings = [];

    for (let pairIndex = 0; pairIndex < teams.length / 2; pairIndex += 1) {
      let homeTeam = arrangement[pairIndex];
      let awayTeam = arrangement[teams.length - 1 - pairIndex];

      if (roundIndex % 2 === 1) {
        [homeTeam, awayTeam] = [awayTeam, homeTeam];
      }

      pairings.push({
        awayTeam,
        homeTeam
      });
    }

    firstLeg.push(pairings);
    rotating.unshift(rotating.pop());
  }

  const secondLeg = firstLeg.map((round) =>
    round.map((pairing) => ({
      awayTeam: pairing.homeTeam,
      homeTeam: pairing.awayTeam
    }))
  );

  return [...firstLeg, ...secondLeg];
}

async function seedSettings() {
  for (const setting of settings) {
    await prisma.setting.upsert({
      create: setting,
      update: {
        value: setting.value
      },
      where: {
        key: setting.key
      }
    });
  }
}

async function seedBadges() {
  for (const badge of badges) {
    await prisma.badge.upsert({
      create: badge,
      update: {
        description: badge.description,
        rarity: badge.rarity
      },
      where: {
        title: badge.title
      }
    });
  }
}

async function upsertSeedUser(seed, role = "USER") {
  const passwordHash = await bcrypt.hash(seed.password, 12);

  return prisma.user.upsert({
    create: {
      email: seed.email,
      emailVerified: new Date(),
      name: seed.name,
      passwordHash,
      role,
      status: "ACTIVE",
      termsAcceptedAt: new Date(),
      username: seed.username
    },
    update: {
      deletedAt: null,
      emailVerified: new Date(),
      name: seed.name,
      passwordHash,
      role,
      status: "ACTIVE",
      termsAcceptedAt: new Date(),
      username: seed.username
    },
    where: {
      email: seed.email
    }
  });
}

async function seedUsers() {
  const admin = await upsertSeedUser(adminSeed, "SUPER_ADMIN");
  const users = [];

  for (const demoUser of demoUsers) {
    users.push(await upsertSeedUser(demoUser));
  }

  return {
    admin,
    rival: users[1],
    user: users[0]
  };
}

async function upsertMatch(match) {
  const existing = await prisma.match.findFirst({
    select: {
      id: true
    },
    where: {
      awayTeamId: match.awayTeamId,
      homeTeamId: match.homeTeamId,
      roundId: match.roundId
    }
  });

  if (existing) {
    return prisma.match.update({
      data: match,
      where: {
        id: existing.id
      }
    });
  }

  return prisma.match.create({
    data: match
  });
}

async function seedBrasileiraoFicticio({ admin, rival, user }) {
  const now = new Date();
  const championship = await prisma.championship.upsert({
    create: {
      apiId: 2026999,
      country: "Brasil",
      description: "Campeonato brasileiro ficticio completo para testes do Bolao do Lobo.",
      name: "Brasileirao Ficticio 2026",
      primaryColor: "#f59e0b",
      provider: "seed",
      status: "ACTIVE"
    },
    update: {
      country: "Brasil",
      deletedAt: null,
      description: "Campeonato brasileiro ficticio completo para testes do Bolao do Lobo.",
      name: "Brasileirao Ficticio 2026",
      primaryColor: "#f59e0b",
      status: "ACTIVE"
    },
    where: {
      provider_apiId: {
        apiId: 2026999,
        provider: "seed"
      }
    }
  });

  const season = await prisma.season.upsert({
    create: {
      championshipId: championship.id,
      name: "Serie A Ficticia",
      status: "ACTIVE",
      year: 2026
    },
    update: {
      name: "Serie A Ficticia",
      status: "ACTIVE"
    },
    where: {
      championshipId_year: {
        championshipId: championship.id,
        year: 2026
      }
    }
  });

  const league = await prisma.league.upsert({
    create: {
      description:
        "Liga de teste com o Brasileirao Ficticio 2026 completo: 20 clubes, 38 rodadas e 380 jogos.",
      entryFee: 0,
      inviteCode: "BRLOBO2026",
      name: "Bolao Brasileirao Ficticio",
      ownerId: admin.id,
      rules: {
        campeonato: championship.name,
        rodadas: 38,
        times: 20
      },
      status: "OPEN",
      visibility: "PRIVATE"
    },
    update: {
      deletedAt: null,
      description:
        "Liga de teste com o Brasileirao Ficticio 2026 completo: 20 clubes, 38 rodadas e 380 jogos.",
      entryFee: 0,
      name: "Bolao Brasileirao Ficticio",
      ownerId: admin.id,
      rules: {
        campeonato: championship.name,
        rodadas: 38,
        times: 20
      },
      status: "OPEN",
      visibility: "PRIVATE"
    },
    where: {
      inviteCode: "BRLOBO2026"
    }
  });

  await Promise.all(
    [
      { role: "OWNER", userId: admin.id },
      { role: "MEMBER", userId: user.id },
      { role: "MEMBER", userId: rival.id }
    ].map((member) =>
      prisma.leagueMember.upsert({
        create: {
          leagueId: league.id,
          role: member.role,
          status: "ACTIVE",
          userId: member.userId
        },
        update: {
          leftAt: null,
          role: member.role,
          status: "ACTIVE"
        },
        where: {
          leagueId_userId: {
            leagueId: league.id,
            userId: member.userId
          }
        }
      })
    )
  );

  const activeUsers = await prisma.user.findMany({
    select: {
      id: true
    },
    where: {
      deletedAt: null,
      status: "ACTIVE"
    }
  });

  await Promise.all(
    activeUsers.map((activeUser) =>
      prisma.leagueMember.upsert({
        create: {
          leagueId: league.id,
          role: activeUser.id === admin.id ? "OWNER" : "MEMBER",
          status: "ACTIVE",
          userId: activeUser.id
        },
        update: {
          leftAt: null,
          role: activeUser.id === admin.id ? "OWNER" : "MEMBER",
          status: "ACTIVE"
        },
        where: {
          leagueId_userId: {
            leagueId: league.id,
            userId: activeUser.id
          }
        }
      })
    )
  );

  await prisma.$transaction([
    prisma.score.deleteMany({
      where: {
        leagueId: league.id
      }
    }),
    prisma.guess.deleteMany({
      where: {
        leagueId: league.id
      }
    }),
    prisma.ranking.deleteMany({
      where: {
        OR: [
          {
            leagueId: league.id
          },
          {
            round: {
              leagueId: league.id
            }
          },
          {
            seasonId: season.id
          }
        ]
      }
    }),
    prisma.match.deleteMany({
      where: {
        round: {
          leagueId: league.id
        }
      }
    }),
    prisma.round.deleteMany({
      where: {
        leagueId: league.id
      }
    })
  ]);

  const teams = await Promise.all(
    fictionalTeams.map((team) =>
      prisma.team.upsert({
        create: team,
        update: team,
        where: {
          apiId: team.apiId
        }
      })
    )
  );

  const pairingsByRound = generateRoundPairings(teams);
  const firstRoundStart = atLocalTime(addDays(now, -1), 8);
  const openRoundEnd = atLocalTime(addDays(now, 6), 23, 59);
  const futureRoundStart = atLocalTime(addDays(now, 7), 8);
  const matchHours = [16, 18, 20, 21, 19, 17, 15, 18, 20, 21];
  const matches = [];

  for (let roundIndex = 0; roundIndex < pairingsByRound.length; roundIndex += 1) {
    const roundNumber = roundIndex + 1;
    const isFirstRound = roundNumber === 1;
    const startsAt = isFirstRound ? firstRoundStart : addDays(futureRoundStart, (roundNumber - 2) * 7);
    const endsAt = isFirstRound ? openRoundEnd : atLocalTime(addDays(startsAt, 6), 23, 59);
    const round = await prisma.round.upsert({
      create: {
        description: `Tabela pre-definida do Brasileirao Ficticio 2026 - rodada ${roundNumber}.`,
        endsAt,
        leagueId: league.id,
        name: `Rodada ${roundNumber}`,
        number: roundNumber,
        seasonId: season.id,
        startsAt,
        status: isFirstRound ? "OPEN" : "SCHEDULED"
      },
      update: {
        description: `Tabela pre-definida do Brasileirao Ficticio 2026 - rodada ${roundNumber}.`,
        endsAt,
        leagueId: league.id,
        name: `Rodada ${roundNumber}`,
        startsAt,
        status: isFirstRound ? "OPEN" : "SCHEDULED"
      },
      where: {
        leagueId_seasonId_number: {
          leagueId: league.id,
          number: roundNumber,
          seasonId: season.id
        }
      }
    });

    const pairings = pairingsByRound[roundIndex];

    for (let matchIndex = 0; matchIndex < pairings.length; matchIndex += 1) {
      const pairing = pairings[matchIndex];
      const isValidatedDemoMatch = roundNumber === 1 && matchIndex === 0;
      const kickoff = isValidatedDemoMatch
        ? atLocalTime(addDays(now, -1), 19)
        : atLocalTime(
            addDays(isFirstRound ? now : startsAt, isFirstRound ? 1 + Math.floor(matchIndex / 3) : 2 + Math.floor(matchIndex / 4)),
            matchHours[matchIndex],
            matchIndex % 2 === 0 ? 0 : 30
          );

      const match = await upsertMatch({
        awayScore: isValidatedDemoMatch ? 1 : null,
        awayTeamId: pairing.awayTeam.id,
        city: "Cidade Sede",
        country: "Brasil",
        homeScore: isValidatedDemoMatch ? 2 : null,
        homeTeamId: pairing.homeTeam.id,
        homologatedAt: isValidatedDemoMatch ? new Date() : null,
        kickoff,
        roundId: round.id,
        stadium: `Estadio ${pairing.homeTeam.shortName}`,
        status: isValidatedDemoMatch ? "FINISHED" : "SCHEDULED"
      });

      matches.push({
        awayTeam: pairing.awayTeam,
        homeTeam: pairing.homeTeam,
        kickoff,
        match,
        round
      });
    }
  }

  await seedValidatedGuesses({
    league,
    matchInfo: matches[0],
    rival,
    season,
    user
  });

  return {
    championship,
    league,
    matches,
    season
  };
}

async function seedValidatedGuesses({ league, matchInfo, rival, season, user }) {
  const official = {
    awayScore: 1,
    homeScore: 2
  };
  const submittedAt = addDays(matchInfo.kickoff, -1);
  const guesses = [
    {
      awayPrediction: 1,
      homePrediction: 2,
      joker: true,
      prediction: "HOME",
      user
    },
    {
      awayPrediction: 0,
      homePrediction: 1,
      joker: false,
      prediction: "HOME",
      user: rival
    }
  ];
  const scoreRows = [];

  for (const guessInput of guesses) {
    const guess = await prisma.guess.upsert({
      create: {
        awayPrediction: guessInput.awayPrediction,
        homePrediction: guessInput.homePrediction,
        joker: guessInput.joker,
        leagueId: league.id,
        matchId: matchInfo.match.id,
        prediction: guessInput.prediction,
        submittedAt,
        userId: guessInput.user.id
      },
      update: {
        awayPrediction: guessInput.awayPrediction,
        deletedAt: null,
        homePrediction: guessInput.homePrediction,
        joker: guessInput.joker,
        leagueId: league.id,
        prediction: guessInput.prediction,
        submittedAt
      },
      where: {
        userId_leagueId_matchId: {
          leagueId: league.id,
          matchId: matchInfo.match.id,
          userId: guessInput.user.id
        }
      }
    });

    const calculated = calculateScore(guessInput, official);

    await prisma.score.upsert({
      create: {
        basePoints: calculated.basePoints,
        bonusPoints: calculated.bonusPoints,
        calculatedAt: new Date(),
        exactScore: calculated.exactScore,
        guessId: guess.id,
        jokerApplied: calculated.jokerApplied,
        leagueId: league.id,
        matchId: matchInfo.match.id,
        totalPoints: calculated.totalPoints,
        userId: guessInput.user.id,
        winnerHit: calculated.winnerHit
      },
      update: {
        basePoints: calculated.basePoints,
        bonusPoints: calculated.bonusPoints,
        calculatedAt: new Date(),
        exactScore: calculated.exactScore,
        jokerApplied: calculated.jokerApplied,
        leagueId: league.id,
        totalPoints: calculated.totalPoints,
        winnerHit: calculated.winnerHit
      },
      where: {
        guessId: guess.id
      }
    });

    scoreRows.push({
      exactScore: calculated.exactScore,
      matchKickoff: matchInfo.kickoff,
      submittedAt,
      totalPoints: calculated.totalPoints,
      userId: guessInput.user.id,
      winnerHit: calculated.winnerHit
    });
  }

  await prisma.ranking.deleteMany({
    where: {
      userId: {
        in: guesses.map((guess) => guess.user.id)
      }
    }
  });

  const rankings = [
    ...buildRankingRows(scoreRows, {
      leagueId: league.id,
      scope: "LEAGUE"
    }),
    ...buildRankingRows(scoreRows, {
      roundId: matchInfo.round.id,
      scope: "ROUND"
    }),
    ...buildRankingRows(scoreRows, {
      scope: "GLOBAL"
    }),
    ...buildRankingRows(scoreRows, {
      scope: "HISTORICAL"
    }),
    ...buildRankingRows(scoreRows, {
      scope: "GLOBAL",
      seasonId: season.id
    })
  ];

  await prisma.ranking.createMany({
    data: rankings
  });
}

async function main() {
  await seedSettings();
  await seedBadges();
  const users = await seedUsers();
  const seeded = await seedBrasileiraoFicticio(users);

  console.log(
    JSON.stringify(
      {
        admin: adminSeed.email,
        championship: seeded.championship.name,
        demoUser: demoUsers[0].email,
        inviteCode: seeded.league.inviteCode,
        league: seeded.league.name,
        matches: seeded.matches.length,
        rounds: 38
      },
      null,
      2
    )
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
