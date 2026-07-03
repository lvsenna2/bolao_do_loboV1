"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requireAdmin, requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import {
  createAdminLeagueSchema,
  createLeagueSchema,
  joinPublicLeagueSchema,
  joinLeagueSchema,
  type CreateAdminLeagueInput,
  type CreateLeagueInput,
  type JoinLeagueInput,
  type JoinPublicLeagueInput
} from "../schemas/league-schemas";
import type { LeagueActionResult } from "../types/league-action-result";

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
  revalidatePath("/dashboard");
  revalidatePath("/minhas-ligas");
  revalidatePath("/ranking");
  revalidatePath("/rodadas");
  revalidatePath("/palpites");
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
  const inviteCode = input.visibility === "PUBLIC" ? null : await createInviteCode();

  const league = await prisma.$transaction(async (tx) => {
    const createdLeague = await tx.league.create({
      data: {
        description: input.description || null,
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
  maxMembers: number | null;
  name: string;
  status: string;
  visibility: string;
};

async function joinLeagueForUser(
  userId: string,
  league: JoinableLeague,
  auditAction: string
): Promise<LeagueActionResult> {
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

  if (existingMembership && existingMembership.status !== "LEFT") {
    return {
      ok: false,
      message: "Voce ja participa desta liga."
    };
  }

  if (league.maxMembers && activeMemberCount >= league.maxMembers) {
    return {
      ok: false,
      message: "Esta liga atingiu o limite de participantes."
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

  const league = await createLeagueForOwner(
    user.id,
    parsedInput.data,
    user.id,
    "league.created"
  );

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

  return {
    ok: true,
    message: `Liga ${league.name} criada com sucesso.`
  };
}

export async function joinLeagueAction(input: JoinLeagueInput): Promise<LeagueActionResult> {
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

export async function joinPublicLeagueAction(
  input: JoinPublicLeagueInput
): Promise<LeagueActionResult> {
  const user = await requireUser();
  const parsedInput = joinPublicLeagueSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Liga invalida.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const league = await prisma.league.findFirst({
    where: {
      deletedAt: null,
      id: parsedInput.data.leagueId,
      visibility: "PUBLIC"
    }
  });

  if (!league) {
    return {
      ok: false,
      message: "Liga publica nao encontrada."
    };
  }

  return joinLeagueForUser(user.id, league, "league.public_joined");
}
