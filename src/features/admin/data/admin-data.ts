import type {
  AccountStatus,
  ChampionshipStatus,
  LeagueStatus,
  PaymentStatus,
  Prisma,
  RoundStatus,
  UserRole
} from "@prisma/client";

import { prisma } from "@/server/db";
import type { AdminDataResult } from "../types";

const DEFAULT_PAGE_SIZE = 20;

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] : value;
}

function getPage(searchParams: SearchParams) {
  const page = Number(getParam(searchParams, "page") ?? "1");

  return Number.isFinite(page) && page > 0 ? page : 1;
}

function getPagination(searchParams: SearchParams) {
  const page = getPage(searchParams);

  return {
    page,
    skip: (page - 1) * DEFAULT_PAGE_SIZE,
    take: DEFAULT_PAGE_SIZE
  };
}

function emptyResult<T>(message: string, data: T): AdminDataResult<T> {
  return {
    ok: false,
    message,
    data
  };
}

function toCurrency(value: Prisma.Decimal | number | null | undefined) {
  const amount =
    typeof value === "number"
      ? value
      : typeof value?.toNumber === "function"
        ? value.toNumber()
        : 0;

  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency"
  }).format(amount);
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    end,
    start
  };
}

export async function getAdminDashboardData() {
  const empty = {
    accessToday: 0,
    activeUsers: 0,
    errors: 0,
    leagues: 0,
    matches: 0,
    pendingPayments: 0,
    recentAuditLogs: [],
    recentUsers: [],
    revenue: "R$ 0,00",
    users: 0
  };

  try {
    const { end, start } = todayRange();
    const [
      users,
      activeUsers,
      leagues,
      matches,
      pendingPayments,
      revenue,
      accessToday,
      errors,
      recentUsers,
      recentAuditLogs
    ] = await prisma.$transaction([
      prisma.user.count({
        where: {
          deletedAt: null
        }
      }),
      prisma.user.count({
        where: {
          deletedAt: null,
          status: "ACTIVE"
        }
      }),
      prisma.league.count({
        where: {
          deletedAt: null
        }
      }),
      prisma.match.count({
        where: {
          deletedAt: null
        }
      }),
      prisma.payment.count({
        where: {
          status: "PENDING"
        }
      }),
      prisma.payment.aggregate({
        _sum: {
          amount: true
        },
        where: {
          status: "APPROVED"
        }
      }),
      prisma.auditLog.count({
        where: {
          action: "auth.login.success",
          createdAt: {
            gte: start,
            lt: end
          }
        }
      }),
      prisma.auditLog.count({
        where: {
          action: {
            contains: "error",
            mode: "insensitive"
          }
        }
      }),
      prisma.user.findMany({
        orderBy: {
          createdAt: "desc"
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true
        },
        take: 5
      }),
      prisma.auditLog.findMany({
        include: {
          user: {
            select: {
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 6
      })
    ]);

    return {
      ok: true as const,
      data: {
        accessToday,
        activeUsers,
        errors,
        leagues,
        matches,
        pendingPayments,
        recentAuditLogs,
        recentUsers,
        revenue: toCurrency(revenue._sum.amount),
        users
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar o painel administrativo.", empty);
  }
}

export async function getAdminUsers(searchParams: SearchParams) {
  const empty = {
    items: [],
    page: getPage(searchParams),
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0
  };

  try {
    const { page, skip, take } = getPagination(searchParams);
    const q = getParam(searchParams, "q");
    const role = getParam(searchParams, "role") as UserRole | undefined;
    const status = getParam(searchParams, "status") as AccountStatus | undefined;

    const where: Prisma.UserWhereInput = {
      ...(q
        ? {
            OR: [
              {
                name: {
                  contains: q,
                  mode: "insensitive"
                }
              },
              {
                email: {
                  contains: q,
                  mode: "insensitive"
                }
              },
              {
                username: {
                  contains: q,
                  mode: "insensitive"
                }
              }
            ]
          }
        : {}),
      ...(role ? { role } : {}),
      ...(status ? { status } : { deletedAt: null })
    };

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        orderBy: {
          createdAt: "desc"
        },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          status: true,
          xp: true,
          level: true,
          createdAt: true,
          lastLoginAt: true
        },
        skip,
        take,
        where
      }),
      prisma.user.count({
        where
      })
    ]);

    return {
      ok: true as const,
      data: {
        items,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        total
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar usuarios.", empty);
  }
}

export async function getAdminChampionships(searchParams: SearchParams) {
  const empty = {
    items: [],
    page: getPage(searchParams),
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0
  };

  try {
    const { page, skip, take } = getPagination(searchParams);
    const q = getParam(searchParams, "q");
    const status = getParam(searchParams, "status") as ChampionshipStatus | undefined;
    const where: Prisma.ChampionshipWhereInput = {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              {
                name: {
                  contains: q,
                  mode: "insensitive"
                }
              },
              {
                country: {
                  contains: q,
                  mode: "insensitive"
                }
              }
            ]
          }
        : {}),
      ...(status ? { status } : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.championship.findMany({
        orderBy: {
          createdAt: "desc"
        },
        select: {
          id: true,
          name: true,
          country: true,
          status: true,
          provider: true,
          apiId: true,
          primaryColor: true,
          createdAt: true,
          _count: {
            select: {
              seasons: true
            }
          }
        },
        skip,
        take,
        where
      }),
      prisma.championship.count({
        where
      })
    ]);

    return {
      ok: true as const,
      data: {
        items,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        total
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar campeonatos.", empty);
  }
}

export async function getAdminRounds(searchParams: SearchParams) {
  const empty = {
    items: [],
    leagues: [],
    page: getPage(searchParams),
    pageSize: DEFAULT_PAGE_SIZE,
    roundOptions: [],
    seasons: [],
    teams: [],
    total: 0
  };

  try {
    const { page, skip, take } = getPagination(searchParams);
    const q = getParam(searchParams, "q");
    const status = getParam(searchParams, "status") as RoundStatus | undefined;
    const championshipId = getParam(searchParams, "championship");
    const leagueId = getParam(searchParams, "league");
    const where: Prisma.RoundWhereInput = {
      ...(q
        ? {
            OR: [
              {
                name: {
                  contains: q,
                  mode: "insensitive"
                }
              },
              {
                description: {
                  contains: q,
                  mode: "insensitive"
                }
              },
              {
                season: {
                  championship: {
                    name: {
                      contains: q,
                      mode: "insensitive"
                    }
                  }
                }
              }
            ]
          }
        : {}),
      ...(status ? { status } : {}),
      ...(leagueId ? { leagueId } : {}),
      ...(championshipId
        ? {
            season: {
              championshipId
            }
          }
        : {})
    };

    const [items, total, seasons, teams, roundOptions, leagues] = await prisma.$transaction([
      prisma.round.findMany({
        include: {
          league: {
            select: {
              id: true,
              name: true,
              status: true
            }
          },
          matches: {
            include: {
              awayTeam: {
                select: {
                  name: true,
                  shortName: true
                }
              },
              homeTeam: {
                select: {
                  name: true,
                  shortName: true
                }
              },
              _count: {
                select: {
                  guesses: true,
                  scores: true
                }
              }
            },
            orderBy: {
              kickoff: "asc"
            },
            take: 12,
            where: {
              deletedAt: null
            }
          },
          season: {
            include: {
              championship: {
                select: {
                  id: true,
                  name: true,
                  status: true
                }
              }
            }
          },
          _count: {
            select: {
              matches: true,
              rankings: true
            }
          }
        },
        orderBy: [
          {
            startsAt: "desc"
          },
          {
            number: "desc"
          }
        ],
        skip,
        take,
        where
      }),
      prisma.round.count({
        where
      }),
      prisma.season.findMany({
        include: {
          championship: {
            select: {
              id: true,
              name: true,
              status: true
            }
          }
        },
        orderBy: [
          {
            year: "desc"
          }
        ],
        take: 200,
        where: {
          championship: {
            deletedAt: null
          }
        }
      }),
      prisma.team.findMany({
        orderBy: {
          name: "asc"
        },
        select: {
          country: true,
          id: true,
          name: true,
          shortName: true
        },
        take: 500
      }),
      prisma.round.findMany({
        orderBy: [
          {
            startsAt: "desc"
          },
          {
            number: "desc"
          }
        ],
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
              name: true,
              year: true
            }
          },
          status: true
        },
        take: 200,
        where: {
          season: {
            championship: {
              deletedAt: null
            }
          }
        }
      }),
      prisma.league.findMany({
        orderBy: {
          name: "asc"
        },
        select: {
          id: true,
          name: true,
          status: true
        },
        take: 500,
        where: {
          deletedAt: null
        }
      })
    ]);

    return {
      ok: true as const,
      data: {
        items,
        leagues,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        roundOptions,
        seasons,
        teams,
        total
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar rodadas.", empty);
  }
}

export async function getAdminLeagues(searchParams: SearchParams) {
  const empty = {
    items: [],
    page: getPage(searchParams),
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0
  };

  try {
    const { page, skip, take } = getPagination(searchParams);
    const q = getParam(searchParams, "q");
    const status = getParam(searchParams, "status") as LeagueStatus | undefined;
    const where: Prisma.LeagueWhereInput = {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              {
                name: {
                  contains: q,
                  mode: "insensitive"
                }
              },
              {
                owner: {
                  email: {
                    contains: q,
                    mode: "insensitive"
                  }
                }
              }
            ]
          }
        : {}),
      ...(status ? { status } : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.league.findMany({
        include: {
          owner: {
            select: {
              name: true,
              email: true
            }
          },
          _count: {
            select: {
              members: true,
              payments: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        skip,
        take,
        where
      }),
      prisma.league.count({
        where
      })
    ]);

    return {
      ok: true as const,
      data: {
        items,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        total
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar ligas.", empty);
  }
}

export async function getAdminPayments(searchParams: SearchParams) {
  const empty = {
    items: [],
    page: getPage(searchParams),
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0
  };

  try {
    const { page, skip, take } = getPagination(searchParams);
    const status = getParam(searchParams, "status") as PaymentStatus | undefined;
    const q = getParam(searchParams, "q");
    const where: Prisma.PaymentWhereInput = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              {
                user: {
                  email: {
                    contains: q,
                    mode: "insensitive"
                  }
                }
              },
              {
                league: {
                  name: {
                    contains: q,
                    mode: "insensitive"
                  }
                }
              },
              {
                transactionId: {
                  contains: q,
                  mode: "insensitive"
                }
              }
            ]
          }
        : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.payment.findMany({
        include: {
          league: {
            select: {
              name: true
            }
          },
          user: {
            select: {
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        skip,
        take,
        where
      }),
      prisma.payment.count({
        where
      })
    ]);

    return {
      ok: true as const,
      data: {
        items,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        total
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar pagamentos.", empty);
  }
}

export async function getAdminGuesses(searchParams: SearchParams) {
  const empty = {
    items: [],
    page: getPage(searchParams),
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0
  };

  try {
    const { page, skip, take } = getPagination(searchParams);
    const q = getParam(searchParams, "q");
    const where: Prisma.GuessWhereInput = {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              {
                user: {
                  name: {
                    contains: q,
                    mode: "insensitive"
                  }
                }
              },
              {
                user: {
                  email: {
                    contains: q,
                    mode: "insensitive"
                  }
                }
              },
              {
                league: {
                  name: {
                    contains: q,
                    mode: "insensitive"
                  }
                }
              },
              {
                match: {
                  homeTeam: {
                    name: {
                      contains: q,
                      mode: "insensitive"
                    }
                  }
                }
              },
              {
                match: {
                  awayTeam: {
                    name: {
                      contains: q,
                      mode: "insensitive"
                    }
                  }
                }
              }
            ]
          }
        : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.guess.findMany({
        orderBy: {
          submittedAt: "desc"
        },
        select: {
          awayPrediction: true,
          homePrediction: true,
          id: true,
          joker: true,
          league: {
            select: {
              name: true
            }
          },
          match: {
            select: {
              awayTeam: {
                select: {
                  name: true,
                  shortName: true
                }
              },
              homeTeam: {
                select: {
                  name: true,
                  shortName: true
                }
              },
              kickoff: true,
              round: {
                select: {
                  name: true,
                  number: true,
                  season: {
                    select: {
                      championship: {
                        select: {
                          name: true
                        }
                      },
                      name: true,
                      year: true
                    }
                  }
                }
              },
              status: true
            }
          },
          prediction: true,
          score: {
            select: {
              exactScore: true,
              totalPoints: true,
              winnerHit: true
            }
          },
          submittedAt: true,
          updatedAt: true,
          user: {
            select: {
              avatarUrl: true,
              email: true,
              name: true,
              username: true
            }
          }
        },
        skip,
        take,
        where
      }),
      prisma.guess.count({
        where
      })
    ]);

    return {
      ok: true as const,
      data: {
        items,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        total
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar palpites.", empty);
  }
}

export async function getAdminAuditLogs(searchParams: SearchParams) {
  const empty = {
    items: [],
    page: getPage(searchParams),
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0
  };

  try {
    const { page, skip, take } = getPagination(searchParams);
    const q = getParam(searchParams, "q");
    const entity = getParam(searchParams, "entity");
    const action = getParam(searchParams, "action");
    const where: Prisma.AuditLogWhereInput = {
      ...(entity ? { entity } : {}),
      ...(action
        ? {
            action: {
              contains: action,
              mode: "insensitive"
            }
          }
        : {}),
      ...(q
        ? {
            OR: [
              {
                user: {
                  email: {
                    contains: q,
                    mode: "insensitive"
                  }
                }
              },
              {
                user: {
                  name: {
                    contains: q,
                    mode: "insensitive"
                  }
                }
              },
              {
                entityId: {
                  contains: q,
                  mode: "insensitive"
                }
              }
            ]
          }
        : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        include: {
          user: {
            select: {
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        skip,
        take,
        where
      }),
      prisma.auditLog.count({
        where
      })
    ]);

    return {
      ok: true as const,
      data: {
        items,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        total
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar auditoria.", empty);
  }
}

export async function getAdminSettings() {
  const fallback = {
    currency: "BRL",
    footballApiProvider: "",
    language: "pt-BR",
    platformName: "Bolao do Lobo",
    supportEmail: "",
    timezone: "America/Sao_Paulo"
  };

  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: Object.keys(fallback)
        }
      }
    });

    return {
      ok: true as const,
      data: settings.reduce((acc, setting) => {
        return {
          ...acc,
          [setting.key]: typeof setting.value === "string" ? setting.value : String(setting.value)
        };
      }, fallback)
    };
  } catch {
    return emptyResult("Nao foi possivel carregar configuracoes.", fallback);
  }
}

export { toCurrency };
