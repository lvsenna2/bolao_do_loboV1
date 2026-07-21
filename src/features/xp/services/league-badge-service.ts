import type { LeagueBadgeCategory } from "@prisma/client";

import { prisma } from "@/server/db";

type GrantLeagueBadgeInput = {
  adminId: string;
  badgeId: string;
  category: LeagueBadgeCategory;
  leagueId: string;
  reason: string;
  userId: string;
};

export async function grantLeagueBadge(input: GrantLeagueBadgeInput) {
  return prisma.$transaction(async (tx) => {
    const [league, badge, membership] = await Promise.all([
      tx.league.findFirst({
        select: { id: true, name: true },
        where: { deletedAt: null, id: input.leagueId }
      }),
      tx.badge.findUnique({
        select: { id: true, title: true },
        where: { id: input.badgeId }
      }),
      tx.leagueMember.findUnique({
        select: { status: true },
        where: { leagueId_userId: { leagueId: input.leagueId, userId: input.userId } }
      })
    ]);

    if (!league) {
      throw new Error("LEAGUE_NOT_FOUND");
    }

    if (!badge) {
      throw new Error("BADGE_NOT_FOUND");
    }

    if (membership?.status !== "ACTIVE") {
      throw new Error("USER_NOT_ACTIVE_IN_LEAGUE");
    }

    const award = await tx.leagueBadgeAward.upsert({
      create: {
        awardedById: input.adminId,
        badgeId: input.badgeId,
        category: input.category,
        leagueId: input.leagueId,
        reason: input.reason,
        userId: input.userId
      },
      update: {
        awardedById: input.adminId,
        category: input.category,
        reason: input.reason
      },
      where: {
        leagueId_userId_badgeId: {
          badgeId: input.badgeId,
          leagueId: input.leagueId,
          userId: input.userId
        }
      }
    });
    const notificationText = `${badge.title} em ${league.name}: ${input.reason}`;

    await tx.notification.upsert({
      create: {
        body: notificationText,
        icon: "league-badge",
        message: notificationText,
        relatedEntityId: award.id,
        title: "Novo emblema conquistado",
        type: "RANKING",
        uniqueKey: `league-badge:${award.id}`,
        userId: input.userId
      },
      update: {
        body: notificationText,
        isRead: false,
        message: notificationText,
        readAt: null
      },
      where: { uniqueKey: `league-badge:${award.id}` }
    });

    await tx.auditLog.create({
      data: {
        action: "admin.xp.league_badge_awarded",
        entity: "LeagueBadgeAward",
        entityId: award.id,
        newValue: {
          badgeId: input.badgeId,
          category: input.category,
          leagueId: input.leagueId,
          reason: input.reason,
          userId: input.userId
        },
        userId: input.adminId
      }
    });

    return { award, badgeTitle: badge.title, leagueName: league.name };
  });
}

export async function revokeLeagueBadge(input: { adminId: string; awardId: string }) {
  return prisma.$transaction(async (tx) => {
    const award = await tx.leagueBadgeAward.findUnique({
      include: {
        badge: { select: { title: true } },
        league: { select: { name: true } }
      },
      where: { id: input.awardId }
    });

    if (!award) {
      throw new Error("AWARD_NOT_FOUND");
    }

    await tx.leagueBadgeAward.delete({ where: { id: award.id } });
    await tx.notification.deleteMany({ where: { uniqueKey: `league-badge:${award.id}` } });
    await tx.auditLog.create({
      data: {
        action: "admin.xp.league_badge_revoked",
        entity: "LeagueBadgeAward",
        entityId: award.id,
        oldValue: {
          badgeId: award.badgeId,
          category: award.category,
          leagueId: award.leagueId,
          reason: award.reason,
          userId: award.userId
        },
        userId: input.adminId
      }
    });

    return { badgeTitle: award.badge.title, leagueName: award.league.name };
  });
}
