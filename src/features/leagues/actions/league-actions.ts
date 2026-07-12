"use server";

import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  createPixPayload,
  createPixTransactionId,
  createQrSvgDataUri,
  getPixReceiverKey
} from "@/features/payments/pix";
import {
  evaluateAchievementsForUser,
  getUserPaidLeaguePricing,
  syncActiveLeagueMissionProgress
} from "@/features/xp/services/xp-service";
import { requireAdmin, requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import {
  createAdminLeagueSchema,
  createLeagueSchema,
  joinAvailableLeagueSchema,
  joinLeagueSchema,
  type CreateAdminLeagueInput,
  type CreateLeagueInput,
  type JoinAvailableLeagueInput,
  type JoinLeagueInput
} from "../schemas/league-schemas";
import type { LeagueActionResult, LeaguePaymentIntent } from "../types/league-action-result";

function normalizeFieldErrors(fieldErrors: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => {
      return Array.isArray(entry[1]) && entry[1].length > 0;
    })
  );
}

function revalidateLeaguePaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/ligas");
  revalidatePath("/admin/pagamentos");
  revalidatePath("/dashboard");
  revalidatePath("/ligas");
  revalidatePath("/minhas-ligas");
  revalidatePath("/perfil");
  revalidatePath("/ranking");
  revalidatePath("/rodadas");
  revalidatePath("/palpites");
  revalidatePath("/xp-ranking");
}

async function createInviteCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = randomBytes(5).toString("hex").toUpperCase();
    const existingLeague = await prisma.league.findUnique({
      where: {
        inviteCode
      },
      select: {
        id: true
      }
    });

    if (!existingLeague) {
      return inviteCode;
    }
  }

  return randomBytes(8).toString("hex").toUpperCase();
}

async function createLeagueForOwner(
  ownerId: string,
  input: CreateLeagueInput,
  auditUserId: string,
  auditAction: string
) {
  const championship = await prisma.championship.findFirst({
    select: {
      id: true,
      name: true
    },
    where: {
      deletedAt: null,
      id: input.championshipId,
      status: "ACTIVE"
    }
  });

  if (!championship) {
    return null;
  }

  const existingLeague = await prisma.league.findFirst({
    select: {
      championship: {
        select: {
          id: true,
          name: true
        }
      },
      id: true,
      inviteCode: true,
      name: true,
      status: true,
      visibility: true
    },
    where: {
      championshipId: championship.id,
      deletedAt: null,
      name: {
        equals: input.name,
        mode: "insensitive"
      },
      ownerId
    }
  });

  if (existingLeague) {
    return existingLeague;
  }

  const inviteCode = input.visibility === "PUBLIC" ? null : await createInviteCode();

  const league = await prisma.$transaction(async (tx) => {
    const createdLeague = await tx.league.create({
      data: {
        description: input.description || null,
        championshipId: championship.id,
        endsAt: input.endsAt ?? null,
        entryFee: input.entryFee,
        imageUrl: input.imageUrl || null,
        inviteCode,
        maxMembers: input.maxMembers ?? null,
        name: input.name,
        ownerId,
        startsAt: input.startsAt ?? null,
        status: "OPEN",
        visibility: input.visibility,
        members: {
          create: {
            role: "OWNER",
            status: "ACTIVE",
            userId: ownerId
          }
        }
      },
      select: {
        id: true,
        championship: {
          select: {
            id: true,
            name: true
          }
        },
        inviteCode: true,
        name: true,
        status: true,
        visibility: true
      }
    });

    await tx.auditLog.create({
      data: {
        action: auditAction,
        entity: "League",
        entityId: createdLeague.id,
        newValue: JSON.parse(JSON.stringify(createdLeague)),
        userId: auditUserId
      }
    });

    return createdLeague;
  });

  revalidateLeaguePaths();

  return league;
}

type JoinableLeague = {
  id: string;
  inviteCode: string | null;
  entryFee: Prisma.Decimal | number | string;
  maxMembers: number | null;
  name: string;
  status: string;
  visibility: string;
};

type PendingPixPayment = {
  id: string;
  amount: Prisma.Decimal | number | string;
  qrCode: string | null;
  transactionId: string | null;
};

type PaidLeaguePricing = Awaited<ReturnType<typeof getUserPaidLeaguePricing>>;

function getMoneyNumber(value: Prisma.Decimal | number | string) {
  return Number(typeof value === "object" ? value.toString() : value);
}

function formatMoney(value: Prisma.Decimal | number | string) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency"
  }).format(getMoneyNumber(value));
}

function requiresPixPayment(league: JoinableLeague) {
  return league.visibility !== "PUBLIC" && getMoneyNumber(league.entryFee) > 0;
}

function toPaymentIntent(
  league: JoinableLeague,
  payment: PendingPixPayment,
  pricing: PaidLeaguePricing
): LeaguePaymentIntent {
  const pixCode =
    payment.qrCode ??
    createPixPayload({
      amount: getMoneyNumber(payment.amount),
      description: league.name,
      transactionId: payment.transactionId ?? createPixTransactionId()
    });

  return {
    amountLabel: formatMoney(payment.amount),
    discountAmountLabel: formatMoney(pricing.discountAmount),
    discountPercent: pricing.discountPercent,
    finalAmountLabel: formatMoney(payment.amount),
    leagueName: league.name,
    levelName: pricing.level.name,
    minimumAmountLabel: formatMoney(pricing.minimumEntryFee),
    originalAmountLabel: formatMoney(pricing.originalAmount),
    pixCode,
    pixKey: getPixReceiverKey(),
    qrCodeDataUri: createQrSvgDataUri(pixCode),
    requiresPayment: true,
    transactionId: payment.transactionId ?? "PENDENTE"
  };
}

async function createPendingPixPayment(
  tx: Prisma.TransactionClient,
  userId: string,
  league: JoinableLeague,
  pricing: PaidLeaguePricing
) {
  const finalAmount = pricing.finalAmount;
  const existingPayment = await tx.payment.findFirst({
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      amount: true,
      qrCode: true,
      transactionId: true
    },
    where: {
      gateway: "PIX",
      leagueId: league.id,
      status: "PENDING",
      userId
    }
  });

  if (existingPayment) {
    const currentAmount = getMoneyNumber(existingPayment.amount);

    if (Math.abs(currentAmount - finalAmount) < 0.01) {
      return existingPayment;
    }

    const transactionId = existingPayment.transactionId ?? createPixTransactionId();
    const pixCode = createPixPayload({
      amount: finalAmount,
      description: league.name,
      transactionId
    });

    return tx.payment.update({
      data: {
        amount: finalAmount,
        qrCode: pixCode,
        transactionId
      },
      select: {
        id: true,
        amount: true,
        qrCode: true,
        transactionId: true
      },
      where: {
        id: existingPayment.id
      }
    });
  }

  const transactionId = createPixTransactionId();
  const pixCode = createPixPayload({
    amount: finalAmount,
    description: league.name,
    transactionId
  });

  return tx.payment.create({
    data: {
      amount: finalAmount,
      gateway: "PIX",
      leagueId: league.id,
      qrCode: pixCode,
      status: "PENDING",
      transactionId,
      userId
    },
    select: {
      id: true,
      amount: true,
      qrCode: true,
      transactionId: true
    }
  });
}

async function joinLeagueForUser(
  userId: string,
  league: JoinableLeague,
  auditAction: string
): Promise<LeagueActionResult<LeaguePaymentIntent>> {
  if (!["OPEN", "ACTIVE"].includes(league.status)) {
    return {
      ok: false,
      message: "Esta liga nao esta aberta para entrada."
    };
  }

  const [activeMemberCount, existingMembership] = await prisma.$transaction([
    prisma.leagueMember.count({
      where: {
        leagueId: league.id,
        status: {
          not: "LEFT"
        }
      }
    }),
    prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: {
          leagueId: league.id,
          userId
        }
      },
      select: {
        id: true,
        status: true
      }
    })
  ]);

  if (existingMembership?.status === "ACTIVE") {
    return {
      ok: false,
      message: "Voce ja participa desta liga."
    };
  }

  if (existingMembership?.status === "BLOCKED") {
    return {
      ok: false,
      message: "Sua participacao nesta liga esta bloqueada."
    };
  }

  if (
    (!existingMembership || existingMembership.status === "LEFT") &&
    league.maxMembers &&
    activeMemberCount >= league.maxMembers
  ) {
    return {
      ok: false,
      message: "Esta liga atingiu o limite de participantes."
    };
  }

  if (requiresPixPayment(league)) {
    const pricing = await getUserPaidLeaguePricing(userId, getMoneyNumber(league.entryFee));
    const payment = await prisma.$transaction(async (tx) => {
      if (existingMembership) {
        await tx.leagueMember.update({
          data: {
            joinedAt: new Date(),
            leftAt: null,
            role: "MEMBER",
            status: "PENDING_PAYMENT"
          },
          where: {
            id: existingMembership.id
          }
        });
      } else {
        await tx.leagueMember.create({
          data: {
            leagueId: league.id,
            role: "MEMBER",
            status: "PENDING_PAYMENT",
            userId
          }
        });
      }

      const pendingPayment = await createPendingPixPayment(tx, userId, league, pricing);

      await tx.auditLog.create({
        data: {
          action: `${auditAction}.payment_pending`,
          entity: "Payment",
          entityId: pendingPayment.transactionId ?? league.id,
          newValue: {
            amount: pendingPayment.amount.toString(),
            discountAmount: pricing.discountAmount,
            discountPercent: pricing.discountPercent,
            gateway: "PIX",
            inviteCode: league.inviteCode,
            leagueId: league.id,
            leagueName: league.name,
            levelName: pricing.level.name,
            originalAmount: pricing.originalAmount,
            status: "PENDING"
          },
          userId
        }
      });

      return pendingPayment;
    });

    revalidateLeaguePaths();

    return {
      ok: true,
      message: "Pagamento Pix gerado. Aguarde a aprovacao do administrador para entrar na liga.",
      data: toPaymentIntent(league, payment, pricing)
    };
  }

  await prisma.$transaction(async (tx) => {
    if (existingMembership) {
      await tx.leagueMember.update({
        data: {
          joinedAt: new Date(),
          leftAt: null,
          role: "MEMBER",
          status: "ACTIVE"
        },
        where: {
          id: existingMembership.id
        }
      });
    } else {
      await tx.leagueMember.create({
        data: {
          leagueId: league.id,
          role: "MEMBER",
          status: "ACTIVE",
          userId
        }
      });
    }

    await tx.auditLog.create({
      data: {
        action: auditAction,
        entity: "League",
        entityId: league.id,
        newValue: {
          inviteCode: league.inviteCode,
          leagueId: league.id,
          leagueName: league.name,
          visibility: league.visibility
        },
        userId
      }
    });
  });

  await Promise.all([syncActiveLeagueMissionProgress(userId), evaluateAchievementsForUser(userId)]);
  revalidateLeaguePaths();

  return {
    ok: true,
    message: `Voce entrou na liga ${league.name}.`
  };
}

export async function createLeagueAction(input: CreateLeagueInput): Promise<LeagueActionResult> {
  const user = await requireUser();
  const parsedInput = createLeagueSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise os dados da liga.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const league = await createLeagueForOwner(user.id, parsedInput.data, user.id, "league.created");

  if (!league) {
    return {
      ok: false,
      message: "Selecione um campeonato ativo para criar a liga.",
      fieldErrors: {
        championshipId: ["Selecione um campeonato ativo."]
      }
    };
  }

  return {
    ok: true,
    message: `Liga ${league.name} criada com sucesso.`
  };
}

export async function createAdminLeagueAction(
  input: CreateAdminLeagueInput
): Promise<LeagueActionResult> {
  const admin = await requireAdmin();
  const parsedInput = createAdminLeagueSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise os dados da liga.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const { ownerEmail, ...leagueInput } = parsedInput.data;
  const owner = ownerEmail
    ? await prisma.user.findFirst({
        where: {
          deletedAt: null,
          email: ownerEmail
        },
        select: {
          id: true
        }
      })
    : { id: admin.id };

  if (!owner) {
    return {
      ok: false,
      message: "Dono da liga nao encontrado.",
      fieldErrors: {
        ownerEmail: ["Informe o e-mail de um usuario cadastrado."]
      }
    };
  }

  const league = await createLeagueForOwner(
    owner.id,
    leagueInput,
    admin.id,
    "admin.league.created"
  );

  if (!league) {
    return {
      ok: false,
      message: "Selecione um campeonato ativo para criar a liga.",
      fieldErrors: {
        championshipId: ["Selecione um campeonato ativo."]
      }
    };
  }

  return {
    ok: true,
    message: `Liga ${league.name} criada com sucesso.`
  };
}

export async function joinLeagueAction(
  input: JoinLeagueInput
): Promise<LeagueActionResult<LeaguePaymentIntent>> {
  const user = await requireUser();
  const parsedInput = joinLeagueSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise o codigo da liga.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const league = await prisma.league.findFirst({
    where: {
      championship: {
        deletedAt: null,
        status: "ACTIVE"
      },
      deletedAt: null,
      inviteCode: parsedInput.data.inviteCode
    }
  });

  if (!league) {
    return {
      ok: false,
      message: "Liga nao encontrada.",
      fieldErrors: {
        inviteCode: ["Confira o codigo informado."]
      }
    };
  }

  return joinLeagueForUser(user.id, league, "league.joined");
}

export async function joinAvailableLeagueAction(
  input: JoinAvailableLeagueInput
): Promise<LeagueActionResult<LeaguePaymentIntent>> {
  const user = await requireUser();
  const parsedInput = joinAvailableLeagueSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Liga invalida.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const league = await prisma.league.findFirst({
    where: {
      championship: {
        deletedAt: null,
        status: "ACTIVE"
      },
      deletedAt: null,
      id: parsedInput.data.leagueId,
      visibility: {
        in: ["PUBLIC", "PRIVATE"]
      }
    }
  });

  if (!league) {
    return {
      ok: false,
      message: "Liga nao encontrada ou indisponivel."
    };
  }

  return joinLeagueForUser(user.id, league, "league.available_joined");
}
