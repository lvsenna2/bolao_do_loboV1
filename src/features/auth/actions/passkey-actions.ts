"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/server/db";
import { getCurrentSession } from "@/server/auth/session";
import {
  createPasskeyRegistrationOptions,
  savePasskeyRegistration
} from "@/server/auth/webauthn";
import type { AuthActionResult } from "../types/auth-action-result";

const MAX_LABEL_LENGTH = 80;

export async function startPasskeyRegistrationAction(): Promise<
  AuthActionResult<{ challengeId: string; options: unknown }>
> {
  const session = await getCurrentSession();

  if (!session?.user) {
    return { message: "Entre na sua conta para cadastrar a biometria.", ok: false };
  }

  try {
    const { challengeId, options } = await createPasskeyRegistrationOptions({
      id: session.user.id,
      name: session.user.name ?? session.user.username,
      username: session.user.username
    });

    return {
      data: { challengeId, options },
      message: "Confirme a biometria no seu aparelho.",
      ok: true
    };
  } catch {
    return { message: "Nao foi possivel iniciar o cadastro da biometria.", ok: false };
  }
}

export async function finishPasskeyRegistrationAction(input: {
  challengeId: string;
  label: string;
  response: string;
}): Promise<AuthActionResult> {
  const session = await getCurrentSession();

  if (!session?.user) {
    return { message: "Entre na sua conta para cadastrar a biometria.", ok: false };
  }

  let parsedResponse;
  try {
    parsedResponse = JSON.parse(input.response);
  } catch {
    return { message: "Resposta invalida do aparelho.", ok: false };
  }

  const label = input.label.trim().slice(0, MAX_LABEL_LENGTH) || "Meu aparelho";

  try {
    const result = await savePasskeyRegistration({
      challengeId: input.challengeId,
      label,
      response: parsedResponse,
      userId: session.user.id
    });

    if (result.ok) {
      revalidatePath("/perfil");
    }

    return result;
  } catch {
    return { message: "Nao foi possivel salvar a biometria deste aparelho.", ok: false };
  }
}

export async function removePasskeyAction(credentialId: string): Promise<AuthActionResult> {
  const session = await getCurrentSession();

  if (!session?.user) {
    return { message: "Entre na sua conta para gerenciar a biometria.", ok: false };
  }

  const removed = await prisma.webAuthnCredential.deleteMany({
    where: {
      id: credentialId,
      userId: session.user.id
    }
  });

  if (removed.count === 0) {
    return { message: "Biometria nao encontrada.", ok: false };
  }

  await prisma.auditLog.create({
    data: {
      action: "auth.passkey.removed",
      entity: "WebAuthnCredential",
      entityId: credentialId,
      userId: session.user.id
    }
  });

  revalidatePath("/perfil");
  return { message: "Biometria removida.", ok: true };
}
