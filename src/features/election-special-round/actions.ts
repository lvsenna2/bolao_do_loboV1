"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { formatDateTimeInSaoPaulo, serverNow } from "@/lib/date-time";
import { requireAdmin, requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getMercadoPagoPayment } from "@/server/mercado-pago/client";
import { ELECTION_2026_ROUND_ID, getMarginRange, getWinnerRange } from "./constants";
import { createElectionPix, reconcileElectionPayment } from "./payment-service";
import { isElectionWinningPrediction } from "./result-service";
import {
  electionCandidateSchema,
  electionCandidateUpdateSchema,
  electionPredictionSchema,
  electionResultSchema,
  electionSettingsSchema
} from "./schemas";
import type { ElectionActionResult, ElectionPaymentView } from "./types";

const serializable = { isolationLevel: "Serializable" as const };

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function fieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}) {
  return Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter((entry): entry is [string, string[]] =>
      Boolean(entry[1]?.length)
    )
  );
}

function revalidateElection() {
  revalidatePath("/rodadas-especiais");
  revalidatePath("/rodadas-especiais/eleicoes-2026");
  revalidatePath("/admin/rodadas-especiais");
  revalidatePath("/admin/rodadas-especiais/eleicoes-2026");
  revalidatePath("/notificacoes");
}

function paymentView(entry: {
  amount: Prisma.Decimal;
  id: string;
  paymentExpiresAt: Date | null;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  transactionId: string | null;
}): ElectionPaymentView | null {
  if (!entry.qrCode || !entry.qrCodeBase64 || !entry.transactionId) return null;
  return {
    amountLabel: Number(entry.amount).toLocaleString("pt-BR", {
      currency: "BRL",
      style: "currency"
    }),
    expiresAtLabel: entry.paymentExpiresAt
      ? formatDateTimeInSaoPaulo(entry.paymentExpiresAt)
      : undefined,
    paymentId: entry.id,
    pixCode: entry.qrCode,
    qrCodeDataUri: `data:image/png;base64,${entry.qrCodeBase64}`,
    ticketUrl: entry.ticketUrl,
    transactionId: entry.transactionId
  };
}

export async function joinElectionRoundAction(
  roundId = ELECTION_2026_ROUND_ID
): Promise<ElectionActionResult<ElectionPaymentView>> {
  const user = await requireUser();
  const now = serverNow();
  const round = await prisma.electionRound.findUnique({ where: { id: roundId } });
  if (
    !round ||
    round.status !== "REGISTRATION_OPEN" ||
    now < round.registrationOpensAt ||
    now >= round.registrationClosesAt
  ) {
    return { message: "As inscrições estão encerradas.", ok: false };
  }
  const payer = await prisma.user.findUnique({
    select: { email: true },
    where: { id: user.id }
  });
  if (!payer) return { message: "Usuário não encontrado.", ok: false };

  const entry = await prisma.$transaction(async (tx) => {
    const existing = await tx.electionEntry.findUnique({
      where: { roundId_userId: { roundId, userId: user.id } }
    });
    if (existing) return existing;
    const created = await tx.electionEntry.create({
      data: {
        amount: round.entryFee,
        checkoutKey: `election:${roundId}:user:${user.id}`,
        confirmedAt: Number(round.entryFee) === 0 ? now : null,
        paymentStatus: Number(round.entryFee) === 0 ? "APPROVED" : "PENDING",
        roundId,
        userId: user.id
      }
    });
    await tx.electionAuditLog.create({
      data: {
        action: "election.entry_created",
        actorId: user.id,
        entity: "ElectionEntry",
        entityId: created.id,
        metadata: json({ amount: Number(created.amount) }),
        roundId
      }
    });
    return created;
  }, serializable);

  if (entry.paymentStatus === "APPROVED") {
    revalidateElection();
    return { message: "Participação liberada.", ok: true };
  }

  const existingPayment = paymentView(entry);
  if (existingPayment) {
    return { data: existingPayment, message: "Pagamento pendente.", ok: true };
  }

  try {
    const payment = await createElectionPix({
      entryId: entry.id,
      payerEmail: payer.email,
      roundName: round.name
    });
    revalidateElection();
    return {
      data: payment,
      message: "PIX gerado. O palpite será liberado após a confirmação.",
      ok: true
    };
  } catch (error) {
    console.error("Election PIX creation failed", {
      entryId: entry.id,
      message: error instanceof Error ? error.message : "unknown"
    });
    return { message: "Não foi possível gerar o PIX. Tente novamente.", ok: false };
  }
}

export async function checkElectionPaymentAction(
  entryId: string
): Promise<ElectionActionResult<{ status: string }>> {
  const user = await requireUser();
  const entry = await prisma.electionEntry.findFirst({
    where: { id: entryId, userId: user.id }
  });
  if (!entry) return { message: "Inscrição não encontrada.", ok: false };
  if (entry.paymentStatus !== "PENDING" || !entry.transactionId) {
    return { data: { status: entry.paymentStatus }, message: "Status consultado.", ok: true };
  }
  try {
    const provider = await getMercadoPagoPayment(entry.transactionId);
    const result = await reconcileElectionPayment(provider);
    if (!result) throw new Error("ELECTION_PAYMENT_NOT_FOUND");
    revalidateElection();
    return { data: { status: result.status }, message: "Status atualizado.", ok: true };
  } catch {
    return { message: "Ainda não foi possível confirmar o pagamento.", ok: false };
  }
}

export async function submitElectionPredictionAction(
  input: unknown
): Promise<ElectionActionResult> {
  const user = await requireUser();
  const parsed = electionPredictionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      fieldErrors: fieldErrors(parsed.error),
      message: "Preencha corretamente os cinco mercados.",
      ok: false
    };
  }
  const now = serverNow();

  try {
    await prisma.$transaction(async (tx) => {
      const entry = await tx.electionEntry.findUnique({
        include: { round: true },
        where: {
          roundId_userId: { roundId: parsed.data.roundId, userId: user.id }
        }
      });
      if (!entry || entry.paymentStatus !== "APPROVED") {
        throw new Error("ELECTION_ENTRY_NOT_APPROVED");
      }
      if (
        entry.round.status !== "REGISTRATION_OPEN" ||
        now < entry.round.registrationOpensAt ||
        now >= entry.round.registrationClosesAt
      ) {
        throw new Error("ELECTION_PREDICTIONS_CLOSED");
      }

      const candidates = await tx.electionCandidate.count({
        where: {
          active: true,
          id: {
            in: [parsed.data.winnerCandidateId, parsed.data.runnerUpCandidateId]
          },
          roundId: entry.roundId
        }
      });
      if (candidates !== 2) throw new Error("ELECTION_INVALID_CANDIDATE");

      const prediction = await tx.electionPrediction.upsert({
        create: {
          entryId: entry.id,
          marginRange: parsed.data.marginRange,
          runnerUpCandidateId: parsed.data.runnerUpCandidateId,
          submittedAt: now,
          turn: parsed.data.turn,
          winnerCandidateId: parsed.data.winnerCandidateId,
          winnerRange: parsed.data.winnerRange
        },
        update: {
          marginRange: parsed.data.marginRange,
          runnerUpCandidateId: parsed.data.runnerUpCandidateId,
          turn: parsed.data.turn,
          winnerCandidateId: parsed.data.winnerCandidateId,
          winnerRange: parsed.data.winnerRange
        },
        where: { entryId: entry.id }
      });
      await tx.electionAuditLog.create({
        data: {
          action: "election.prediction_saved",
          actorId: user.id,
          entity: "ElectionPrediction",
          entityId: prediction.id,
          roundId: entry.roundId
        }
      });
    }, serializable);
  } catch (error) {
    const message =
      error instanceof Error && error.message === "ELECTION_PREDICTIONS_CLOSED"
        ? "O prazo para alterar o palpite foi encerrado."
        : "Não foi possível salvar o palpite.";
    return { message, ok: false };
  }

  revalidateElection();
  return { message: "Palpite eleitoral confirmado.", ok: true };
}

export async function saveElectionSettingsAction(input: unknown): Promise<ElectionActionResult> {
  const admin = await requireAdmin();
  const parsed = electionSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      fieldErrors: fieldErrors(parsed.error),
      message: "Revise as configurações.",
      ok: false
    };
  }
  const value = parsed.data;
  await prisma.$transaction(async (tx) => {
    await tx.electionRound.update({
      data: {
        description: value.description || null,
        name: value.name,
        noWinnerDestination: value.noWinnerDestination || null,
        registrationClosesAt: value.registrationClosesAt,
        registrationOpensAt: value.registrationOpensAt,
        rules: value.rules || null,
        status: value.status
      },
      where: { id: value.roundId }
    });
    await tx.electionAuditLog.create({
      data: {
        action: "election.settings_updated",
        actorId: admin.id,
        entity: "ElectionRound",
        entityId: value.roundId,
        roundId: value.roundId
      }
    });
  }, serializable);
  revalidateElection();
  return { message: "Configurações salvas.", ok: true };
}

export async function createElectionCandidateAction(input: unknown): Promise<ElectionActionResult> {
  const admin = await requireAdmin();
  const parsed = electionCandidateSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error), message: "Revise o candidato.", ok: false };
  }
  const round = await prisma.electionRound.findUnique({ where: { id: parsed.data.roundId } });
  if (!round || serverNow() >= round.registrationClosesAt || round.status === "FINALIZED") {
    return { message: "A lista de candidatos já está bloqueada.", ok: false };
  }
  try {
    await prisma.$transaction(async (tx) => {
      const candidate = await tx.electionCandidate.create({ data: parsed.data });
      await tx.electionAuditLog.create({
        data: {
          action: "election.candidate_created",
          actorId: admin.id,
          entity: "ElectionCandidate",
          entityId: candidate.id,
          roundId: round.id
        }
      });
    }, serializable);
  } catch {
    return { message: "Já existe um candidato com esse nome.", ok: false };
  }
  revalidateElection();
  return { message: "Candidato adicionado.", ok: true };
}

export async function updateElectionCandidateAction(input: unknown): Promise<ElectionActionResult> {
  const admin = await requireAdmin();
  const parsed = electionCandidateUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error), message: "Revise o candidato.", ok: false };
  }
  const round = await prisma.electionRound.findUnique({ where: { id: parsed.data.roundId } });
  if (!round || serverNow() >= round.registrationClosesAt || round.status === "FINALIZED") {
    return { message: "A lista de candidatos já está bloqueada.", ok: false };
  }
  const candidate = await prisma.electionCandidate.updateMany({
    data: {
      name: parsed.data.name,
      party: parsed.data.party,
      sortOrder: parsed.data.sortOrder
    },
    where: { id: parsed.data.candidateId, roundId: parsed.data.roundId }
  });
  if (!candidate.count) return { message: "Candidato não encontrado.", ok: false };
  await prisma.electionAuditLog.create({
    data: {
      action: "election.candidate_updated",
      actorId: admin.id,
      entity: "ElectionCandidate",
      entityId: parsed.data.candidateId,
      roundId: parsed.data.roundId
    }
  });
  revalidateElection();
  return { message: "Candidato atualizado.", ok: true };
}

export async function removeElectionCandidateAction(
  roundId: string,
  candidateId: string
): Promise<ElectionActionResult> {
  const admin = await requireAdmin();
  const round = await prisma.electionRound.findUnique({ where: { id: roundId } });
  if (!round || serverNow() >= round.registrationClosesAt || round.status === "FINALIZED") {
    return { message: "A lista de candidatos já está bloqueada.", ok: false };
  }
  const candidate = await prisma.electionCandidate.updateMany({
    data: { active: false },
    where: { active: true, id: candidateId, roundId }
  });
  if (!candidate.count) return { message: "Candidato não encontrado.", ok: false };
  await prisma.electionAuditLog.create({
    data: {
      action: "election.candidate_removed",
      actorId: admin.id,
      entity: "ElectionCandidate",
      entityId: candidateId,
      roundId
    }
  });
  revalidateElection();
  return {
    message: "Candidato removido. Palpites que o utilizavam deverão ser atualizados.",
    ok: true
  };
}

export async function saveElectionResultAction(
  input: unknown
): Promise<ElectionActionResult<{ winners: number }>> {
  const admin = await requireAdmin();
  const parsed = electionResultSchema.safeParse(input);
  if (!parsed.success) {
    return {
      fieldErrors: fieldErrors(parsed.error),
      message: "Revise o resultado oficial.",
      ok: false
    };
  }
  const value = parsed.data;
  const round = await prisma.electionRound.findUnique({ where: { id: value.roundId } });
  if (!round || round.status === "CANCELLED") {
    return { message: "Rodada eleitoral indisponível.", ok: false };
  }
  if (serverNow() < round.registrationClosesAt && round.status === "REGISTRATION_OPEN") {
    return { message: "Encerre as inscrições antes de informar o resultado.", ok: false };
  }
  const candidateCount = await prisma.electionCandidate.count({
    where: {
      id: { in: [value.winnerCandidateId, value.runnerUpCandidateId] },
      roundId: value.roundId
    }
  });
  if (candidateCount !== 2) return { message: "Candidatos inválidos.", ok: false };

  const winnerRange = getWinnerRange(value.winnerPercent);
  const marginRange = getMarginRange(value.winnerPercent - value.runnerUpPercent);
  const now = serverNow();

  const result = await prisma.$transaction(async (tx) => {
    await tx.electionResult.upsert({
      create: {
        enteredById: admin.id,
        marginRange,
        roundId: value.roundId,
        runnerUpCandidateId: value.runnerUpCandidateId,
        runnerUpPercent: value.runnerUpPercent,
        turn: value.turn,
        winnerCandidateId: value.winnerCandidateId,
        winnerPercent: value.winnerPercent,
        winnerRange
      },
      update: {
        enteredById: admin.id,
        marginRange,
        runnerUpCandidateId: value.runnerUpCandidateId,
        runnerUpPercent: value.runnerUpPercent,
        turn: value.turn,
        winnerCandidateId: value.winnerCandidateId,
        winnerPercent: value.winnerPercent,
        winnerRange
      },
      where: { roundId: value.roundId }
    });

    const entries = await tx.electionEntry.findMany({
      include: { prediction: true },
      where: { paymentStatus: "APPROVED", roundId: value.roundId }
    });
    const officialAnswer = {
      marginRange,
      runnerUpCandidateId: value.runnerUpCandidateId,
      turn: value.turn,
      winnerCandidateId: value.winnerCandidateId,
      winnerRange
    };
    const winners = entries.filter((entry) =>
      isElectionWinningPrediction(entry.prediction, officialAnswer)
    );
    const totalPrize = entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const amount = winners.length ? totalPrize / winners.length : 0;
    const sharePercent = winners.length ? 100 / winners.length : 0;

    await tx.electionWinner.deleteMany({ where: { roundId: value.roundId } });
    for (const winner of winners) {
      await tx.electionWinner.create({
        data: {
          amount,
          entryId: winner.id,
          roundId: value.roundId,
          sharePercent
        }
      });
      await tx.notification.upsert({
        create: {
          body: `Você acertou os cinco mercados de ${round.name}.`,
          icon: "election-winner",
          message: `Você acertou os cinco mercados de ${round.name}.`,
          relatedEntityId: value.roundId,
          title: "Palpite eleitoral vencedor",
          type: "SPECIAL_ROUND",
          uniqueKey: `election:winner:${value.roundId}:${winner.userId}`,
          userId: winner.userId
        },
        update: {},
        where: { uniqueKey: `election:winner:${value.roundId}:${winner.userId}` }
      });
    }

    await tx.electionRound.update({
      data: { finalPrize: totalPrize, finalizedAt: now, status: "FINALIZED" },
      where: { id: value.roundId }
    });
    await tx.electionAuditLog.create({
      data: {
        action: "election.result_finalized",
        actorId: admin.id,
        entity: "ElectionResult",
        entityId: value.roundId,
        metadata: json({ marginRange, totalPrize, winnerRange, winners: winners.length }),
        roundId: value.roundId
      }
    });
    return { winners: winners.length };
  }, serializable);

  revalidateElection();
  return {
    data: result,
    message: result.winners
      ? `Resultado publicado com ${result.winners} vencedor(es).`
      : "Resultado publicado. Sem vencedores.",
    ok: true
  };
}
