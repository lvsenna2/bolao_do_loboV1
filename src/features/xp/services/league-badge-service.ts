import type { LeagueBadgeCategory } from "@prisma/client";

import {
  getOfficialLeagueEmblem,
  type LeagueEmblemScope,
  type OfficialLeagueEmblemKey
} from "@/features/xp/constants/league-emblems";
import { prisma } from "@/server/db";

type GrantLeagueBadgeInput = {
  adminId: string;
  championshipId: string;
  emblemKey: OfficialLeagueEmblemKey;
  reason?: string;
  scope: LeagueEmblemScope;
  userId: string;
};

export async function grantLeagueBadge(input: GrantLeagueBadgeInput) {
  return prisma.$transaction(async (tx) => {
    const emblem = getOfficialLeagueEmblem(input.emblemKey);

    if (!emblem) {
      throw new Error("EMBLEM_NOT_FOUND");
    }

    const [championship, badge, membership] = await Promise.all([
      tx.championship.findFirst({
        select: { id: true, name: true },
        where: { deletedAt: null, id: input.championshipId }
      }),
      tx.badge.upsert({
        create: {
          description: emblem.description,
          image: `/brand/emblems/catalogo-oficial.png#${emblem.key}`,
          key: `OFFICIAL_EMBLEM_${emblem.key}`,
          rarity: emblem.rarity,
          title: emblem.title
        },
        select: { id: true, title: true },
        update: {
          description: emblem.description,
          image: `/brand/emblems/catalogo-oficial.png#${emblem.key}`,
          rarity: emblem.rarity,
          title: emblem.title
        },
        where: { key: `OFFICIAL_EMBLEM_${emblem.key}` }
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

    const isUniversal = input.scope === "UNIVERSAL";
    const reason =
      input.reason ??
      (isUniversal
        ? `${badge.title}, reconhecimento valido em todas as ligas.`
        : `${badge.title} no campeonato ${championship.name}.`);
    const existingAward = await tx.leagueBadgeAward.findFirst({
      select: { id: true },
      where: {
        badgeId: badge.id,
        ...(isUniversal
          ? { isUniversal: true }
          : { championshipId: input.championshipId, isUniversal: false }),
        userId: input.userId
      }
    });
    const awardData = {
      awardedById: input.adminId,
      badgeId: badge.id,
      category: emblem.category as LeagueBadgeCategory,
      championshipId: input.championshipId,
      customTitle: emblem.title,
      emblemColor: "#F4B41A",
      emblemIcon: "OFFICIAL",
      emblemKey: emblem.key,
      emblemStyle: "CATALOG",
      isUniversal,
      leagueId: membership.league.id,
      reason,
      userId: input.userId
    };
    const award = existingAward
      ? await tx.leagueBadgeAward.update({
          data: awardData,
          where: { id: existingAward.id }
        })
      : await tx.leagueBadgeAward.create({
          data: awardData
        });
    const awardTitle = badge.title;
    const notificationText = `${awardTitle} ${isUniversal ? "(universal)" : `em ${championship.name}`}: ${reason}`;

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
          category: emblem.category,
          championshipId: input.championshipId,
          emblemKey: emblem.key,
          isUniversal,
          leagueId: membership.league.id,
          reason,
          userId: input.userId
        },
        userId: input.adminId
      }
    });

    return {
      award,
      badgeTitle: awardTitle,
      championshipName: championship.name,
      isUniversal
    };
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
          emblemKey: award.emblemKey,
          emblemStyle: award.emblemStyle,
          isUniversal: award.isUniversal,
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
