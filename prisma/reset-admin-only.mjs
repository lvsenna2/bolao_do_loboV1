import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const adminSeed = {
  email: process.env.SEED_ADMIN_EMAIL || "admin@bolaodolobo.local",
  name: process.env.SEED_ADMIN_NAME || "Administrador",
  password: process.env.SEED_ADMIN_PASSWORD || "Admin@123",
  username: process.env.SEED_ADMIN_USERNAME || "admin"
};

function getDatabaseHost() {
  try {
    return new URL(process.env.DATABASE_URL || "").hostname;
  } catch {
    return "";
  }
}

function assertResetIsAllowed() {
  const databaseHost = getDatabaseHost();
  const isLocalDatabase = ["localhost", "127.0.0.1", "::1"].includes(databaseHost);
  const isRemoteDatabase = Boolean(databaseHost) && !isLocalDatabase;
  const resetAllowed = process.env.ALLOW_DB_RESET === "true";

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL nao foi definida.");
    process.exit(1);
  }

  if (isRemoteDatabase && !resetAllowed) {
    console.error(
      "Reset bloqueado para banco remoto. Defina ALLOW_DB_RESET=true somente durante a limpeza de homologacao."
    );
    process.exit(1);
  }

  if (isRemoteDatabase && !process.env.SEED_ADMIN_PASSWORD) {
    console.error("Defina SEED_ADMIN_PASSWORD com uma senha segura antes de resetar um banco remoto.");
    process.exit(1);
  }
}

async function resetDatabaseToAdminOnly() {
  const passwordHash = await bcrypt.hash(adminSeed.password, 12);

  const admin = await prisma.$transaction(async (tx) => {
    const deleted = {
      accounts: await tx.account.deleteMany({}),
      achievements: await tx.achievement.deleteMany({}),
      auditLogs: await tx.auditLog.deleteMany({}),
      badges: await tx.badge.deleteMany({}),
      guesses: { count: 0 },
      championships: { count: 0 },
      leagueMembers: { count: 0 },
      leagues: { count: 0 },
      matches: { count: 0 },
      notifications: await tx.notification.deleteMany({}),
      payments: { count: 0 },
      rankings: { count: 0 },
      rounds: { count: 0 },
      scores: { count: 0 },
      seasons: { count: 0 },
      sessions: await tx.session.deleteMany({}),
      settings: await tx.setting.deleteMany({}),
      teams: { count: 0 },
      users: { count: 0 },
      verificationTokens: await tx.verificationToken.deleteMany({})
    };

    deleted.scores = await tx.score.deleteMany({});
    deleted.guesses = await tx.guess.deleteMany({});
    deleted.rankings = await tx.ranking.deleteMany({});
    deleted.payments = await tx.payment.deleteMany({});
    deleted.leagueMembers = await tx.leagueMember.deleteMany({});
    deleted.matches = await tx.match.deleteMany({});
    deleted.rounds = await tx.round.deleteMany({});
    deleted.leagues = await tx.league.deleteMany({});
    deleted.seasons = await tx.season.deleteMany({});
    deleted.championships = await tx.championship.deleteMany({});
    deleted.teams = await tx.team.deleteMany({});

    deleted.users = await tx.user.deleteMany({
      where: {
        email: {
          not: adminSeed.email
        }
      }
    });

    const upsertedAdmin = await tx.user.upsert({
      create: {
        email: adminSeed.email,
        emailVerified: new Date(),
        name: adminSeed.name,
        passwordHash,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        termsAcceptedAt: new Date(),
        username: adminSeed.username
      },
      update: {
        deletedAt: null,
        emailVerified: new Date(),
        name: adminSeed.name,
        passwordHash,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        termsAcceptedAt: new Date(),
        username: adminSeed.username
      },
      where: {
        email: adminSeed.email
      }
    });

    return {
      deleted,
      upsertedAdmin
    };
  });

  return admin;
}

async function main() {
  assertResetIsAllowed();

  const result = await resetDatabaseToAdminOnly();

  console.log(
    JSON.stringify(
      {
        admin: {
          email: result.upsertedAdmin.email,
          role: result.upsertedAdmin.role,
          status: result.upsertedAdmin.status,
          username: result.upsertedAdmin.username
        },
        deleted: Object.fromEntries(
          Object.entries(result.deleted).map(([key, value]) => [key, value.count])
        )
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
