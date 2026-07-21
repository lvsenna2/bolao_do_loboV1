import type { LeagueBadgeCategory } from "@prisma/client";

import {
  getLeagueEmblemCategory,
  type LeagueEmblemIcon,
  type LeagueEmblemStyle
} from "@/features/xp/constants/league-emblems";
import { prisma } from "@/server/db";

type GrantLeagueBadgeInput = {
  adminId: string;
  category: LeagueBadgeCategory;
  championshipId: string;
  customTitle?: string;
  emblemColor: string;
  emblemIcon: LeagueEmblemIcon;
  emblemStyle: LeagueEmblemStyle;
  reason?: string;
  userId: string;
};

export async function grantLeagueBadge(input: GrantLeagueBadgeInput) {
  return prisma.$transaction(async (tx) => {
    const categoryDefinition = getLeagueEmblemCategory(input.category);
    const [championship, badge, membership] = await Promise.all([
      tx.championship.findFirst({
        select: { id: true, name: true },
        where: { deletedAt: null, id: input.championshipId }
      }),
      tx.badge.upsert({
        create: {
          description: `Reconhecimento de ${categoryDefinition.label.toLowerCase()} em um campeonato.`,
          key: categoryDefinition.badgeKey,
          rarity:
            input.category === "CHAMPION" || input.category === "MOST_EXACT_SCORES"
              ? "LEGENDARY"
              : "EPIC",
          title: categoryDefinition.defaultTitle
        },
        select: { id: true, title: true },
        update: {},
        where: { key: categoryDefinition.badgeKey }
      }),
      tx.leagueMember.findFirst({
        orderBy: { joinedAt: "asc" },
        select: { league: { select: { id: true, name: true } } },
        where: {
          league: {
            championshipId: input.championshipId,
            deletedAt: null,
            status: { not: "ARCHIVED" }
          },
          status: "ACTIVE",
          userId: input.userId
        }
      })
    ]);

    if (!championship) {
      throw new Error("CHAMPIONSHIP_NOT_FOUND");
    }

    if (!membership) {
      throw new Error("USER_NOT_ACTIVE_IN_CHAMPIONSHIP");
    }

    const reason =
      input.reason ?? `${input.customTitle || badge.title} no campeonato ${championship.name}.`;
    const award = await tx.leagueBadgeAward.upsert({
      create: {
        awardedById: input.adminId,
        badgeId: badge.id,
        category: input.category,
        championshipId: input.championshipId,
        customTitle: input.customTitle,
        emblemColor: input.emblemColor,
        emblemIcon: input.emblemIcon,
        emblemStyle: input.emblemStyle,
        leagueId: membership.league.id,
        reason,
        userId: input.userId
      },
      update: {
        awardedById: input.adminId,
        category: input.category,
        championshipId: input.championshipId,
        customTitle: input.customTitle,
        emblemColor: input.emblemColor,
        emblemIcon: input.emblemIcon,
        emblemStyle: input.emblemStyle,
        reason
      },
      where: {
        leagueId_userId_badgeId: {
          badgeId: badge.id,
          leagueId: membership.league.id,
          userId: input.userId
        }
      }
    });
    const awardTitle = input.customTitle || badge.title;
    const notificationText = `${awardTitle} em ${championship.name}: ${reason}`;

    await tx.notification.upsert({
      create: {
        body: notificationText,
        icon: "league-badge",
        message: notificationText,
        relatedEntityId: award.id,
        title: "Nova insignia conquistada",
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
          badgeId: badge.id,
          category: input.category,
          championshipId: input.championshipId,
          customTitle: input.customTitle,
          emblemColor: input.emblemColor,
          emblemIcon: input.emblemIcon,
          emblemStyle: input.emblemStyle,
          leagueId: membership.league.id,
          reason,
          userId: input.userId
        },
        userId: input.adminId
      }
    });

    return { award, badgeTitle: awardTitle, championshipName: championship.name };
  });
}

export async function revokeLeagueBadge(input: { adminId: string; awardId: string }) {
  return prisma.$transaction(async (tx) => {
    const award = await tx.leagueBadgeAward.findUnique({
      include: {
        badge: { select: { title: true } },
        championship: { select: { name: true } }
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
          championshipId: award.championshipId,
          customTitle: award.customTitle,
          emblemColor: award.emblemColor,
          emblemIcon: award.emblemIcon,
          emblemStyle: award.emblemStyle,
          leagueId: award.leagueId,
          reason: award.reason,
          userId: award.userId
        },
        userId: input.adminId
      }
    });

    return {
      badgeTitle: award.customTitle || award.badge.title,
      championshipName: award.championship.name
    };
  });
}
