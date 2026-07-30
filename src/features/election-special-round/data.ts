import { prisma } from "@/server/db";
import { ELECTION_2026_ROUND_ID } from "./constants";

export function getElectionRoundForUser(userId: string) {
  return prisma.electionRound.findUnique({
    include: {
      _count: {
        select: { entries: { where: { paymentStatus: "APPROVED" } } }
      },
      candidates: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        where: { active: true }
      },
      entries: {
        include: {
          prediction: {
            include: {
              runnerUpCandidate: true,
              winnerCandidate: true
            }
          },
          winner: true
        },
        where: { userId }
      },
      result: {
        include: {
          runnerUpCandidate: true,
          winnerCandidate: true
        }
      },
      winners: {
        include: {
          entry: {
            include: {
              user: { select: { avatarUrl: true, id: true, name: true, username: true } }
            }
          }
        },
        orderBy: { amount: "desc" }
      }
    },
    where: { id: ELECTION_2026_ROUND_ID }
  });
}

export function getElectionRoundSummary() {
  return prisma.electionRound.findUnique({
    include: {
      _count: {
        select: { entries: { where: { paymentStatus: "APPROVED" } } }
      }
    },
    where: { id: ELECTION_2026_ROUND_ID }
  });
}

export function getAdminElectionRound() {
  return prisma.electionRound.findUnique({
    include: {
      candidates: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
      },
      entries: {
        include: {
          prediction: {
            include: {
              runnerUpCandidate: true,
              winnerCandidate: true
            }
          },
          user: { select: { email: true, id: true, name: true } },
          winner: true
        },
        orderBy: { registeredAt: "asc" }
      },
      result: {
        include: {
          runnerUpCandidate: true,
          winnerCandidate: true
        }
      },
      winners: {
        include: {
          entry: {
            include: {
              user: { select: { email: true, id: true, name: true } }
            }
          }
        }
      }
    },
    where: { id: ELECTION_2026_ROUND_ID }
  });
}
