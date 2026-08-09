import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON
} from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";

import { serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";

const CHALLENGE_TTL_MS = 5 * 60_000;
const RP_NAME = "Bolao do Lobo";

export type PasskeyChallengeType = "authentication" | "registration";

export type RelyingParty = {
  origins: string[];
  rpId: string;
};

/**
 * O rpId usa sempre o dominio sem "www." para que a mesma passkey valha no apex e no
 * subdominio www. As origens aceitas incluem as duas variantes, porque o navegador envia
 * exatamente a origem que o usuario acessou e ela precisa bater na verificacao.
 */
export function resolveRelyingParty(
  baseUrl = process.env.NEXTAUTH_URL,
  extraOrigins = process.env.WEBAUTHN_EXTRA_ORIGINS
): RelyingParty {
  const fallback = "http://localhost:3000";
  let url: URL;

  try {
    url = new URL(baseUrl?.trim() || fallback);
  } catch {
    url = new URL(fallback);
  }

  const rpId = url.hostname.replace(/^www\./, "");
  const apexOrigin = `${url.protocol}//${rpId}${url.port ? `:${url.port}` : ""}`;
  const wwwOrigin = `${url.protocol}//www.${rpId}${url.port ? `:${url.port}` : ""}`;
  const additional = (extraOrigins ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    origins: Array.from(new Set([url.origin, apexOrigin, wwwOrigin, ...additional])),
    rpId
  };
}

export function isChallengeUsable(
  challenge: { expiresAt: Date; type: string } | null,
  expectedType: PasskeyChallengeType,
  now = serverNow()
) {
  return Boolean(
    challenge && challenge.type === expectedType && challenge.expiresAt.getTime() > now.getTime()
  );
}

export function normalizeTransports(transports: string[] | undefined) {
  return (transports ?? []).filter((value): value is string => typeof value === "string");
}

async function createChallenge(type: PasskeyChallengeType, challenge: string, userId?: string) {
  const now = serverNow();

  await prisma.webAuthnChallenge.deleteMany({
    where: { expiresAt: { lt: now } }
  });

  const stored = await prisma.webAuthnChallenge.create({
    data: {
      challenge,
      expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
      type,
      userId
    },
    select: { id: true }
  });

  return stored.id;
}

async function consumeChallenge(challengeId: string, expectedType: PasskeyChallengeType) {
  const stored = await prisma.webAuthnChallenge.findUnique({
    where: { id: challengeId }
  });

  if (stored) {
    await prisma.webAuthnChallenge.delete({ where: { id: challengeId } });
  }

  if (!isChallengeUsable(stored, expectedType)) {
    return null;
  }

  return stored;
}

export async function createPasskeyRegistrationOptions(user: {
  id: string;
  name: string;
  username: string;
}) {
  const { rpId } = resolveRelyingParty();
  const existing = await prisma.webAuthnCredential.findMany({
    select: { credentialId: true, transports: true },
    where: { userId: user.id }
  });

  const options = await generateRegistrationOptions({
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred"
    },
    excludeCredentials: existing.map((credential) => ({
      id: credential.credentialId,
      transports: credential.transports as never
    })),
    rpID: rpId,
    rpName: RP_NAME,
    userDisplayName: user.name,
    userID: isoUint8Array.fromUTF8String(user.id),
    userName: user.username
  });

  const challengeId = await createChallenge("registration", options.challenge, user.id);

  return { challengeId, options };
}

export async function savePasskeyRegistration(input: {
  challengeId: string;
  label: string;
  response: RegistrationResponseJSON;
  userId: string;
}) {
  const stored = await consumeChallenge(input.challengeId, "registration");

  if (!stored || stored.userId !== input.userId) {
    return { message: "Sessao de cadastro expirada. Tente novamente.", ok: false as const };
  }

  const { origins, rpId } = resolveRelyingParty();
  const verification = await verifyRegistrationResponse({
    expectedChallenge: stored.challenge,
    expectedOrigin: origins,
    expectedRPID: rpId,
    requireUserVerification: false,
    response: input.response
  });

  if (!verification.verified || !verification.registrationInfo) {
    return { message: "Nao foi possivel validar a biometria deste aparelho.", ok: false as const };
  }

  const { credential, credentialBackedUp, credentialDeviceType } = verification.registrationInfo;

  await prisma.webAuthnCredential.upsert({
    create: {
      backedUp: credentialBackedUp,
      counter: BigInt(credential.counter),
      credentialId: credential.id,
      deviceType: credentialDeviceType,
      label: input.label,
      publicKey: Buffer.from(credential.publicKey),
      transports: normalizeTransports(credential.transports),
      userId: input.userId
    },
    update: {
      backedUp: credentialBackedUp,
      counter: BigInt(credential.counter),
      deviceType: credentialDeviceType,
      label: input.label,
      publicKey: Buffer.from(credential.publicKey),
      transports: normalizeTransports(credential.transports)
    },
    where: { credentialId: credential.id }
  });

  await prisma.auditLog.create({
    data: {
      action: "auth.passkey.registered",
      entity: "WebAuthnCredential",
      entityId: credential.id,
      userId: input.userId
    }
  });

  return { message: "Biometria cadastrada com sucesso.", ok: true as const };
}

export async function createPasskeyLoginOptions() {
  const { rpId } = resolveRelyingParty();
  const options = await generateAuthenticationOptions({
    rpID: rpId,
    userVerification: "preferred"
  });
  const challengeId = await createChallenge("authentication", options.challenge);

  return { challengeId, options };
}

export async function verifyPasskeyLogin(challengeId: string, response: AuthenticationResponseJSON) {
  const stored = await consumeChallenge(challengeId, "authentication");

  if (!stored) return null;

  const credential = await prisma.webAuthnCredential.findUnique({
    select: {
      counter: true,
      credentialId: true,
      id: true,
      publicKey: true,
      transports: true,
      user: {
        select: {
          deletedAt: true,
          email: true,
          id: true,
          name: true,
          role: true,
          status: true,
          username: true
        }
      }
    },
    where: { credentialId: response.id }
  });

  if (!credential || credential.user.deletedAt) return null;

  const { origins, rpId } = resolveRelyingParty();

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      credential: {
        counter: Number(credential.counter),
        id: credential.credentialId,
        publicKey: new Uint8Array(credential.publicKey),
        transports: credential.transports as never
      },
      expectedChallenge: stored.challenge,
      expectedOrigin: origins,
      expectedRPID: rpId,
      requireUserVerification: false,
      response
    });
  } catch {
    return null;
  }

  if (!verification.verified) {
    await prisma.auditLog.create({
      data: {
        action: "auth.login.failed",
        entity: "User",
        entityId: credential.user.id,
        userId: credential.user.id
      }
    });
    return null;
  }

  if (credential.user.status === "BLOCKED" || credential.user.status === "DELETED") {
    await prisma.auditLog.create({
      data: {
        action: "auth.login.failed",
        entity: "User",
        entityId: credential.user.id,
        userId: credential.user.id
      }
    });
    return null;
  }

  const now = serverNow();
  await Promise.all([
    prisma.webAuthnCredential.update({
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: now
      },
      where: { id: credential.id }
    }),
    prisma.user.update({
      data: { lastLoginAt: now },
      where: { id: credential.user.id }
    }),
    prisma.auditLog.create({
      data: {
        action: "auth.login.success",
        entity: "User",
        entityId: credential.user.id,
        userId: credential.user.id
      }
    })
  ]);

  return {
    email: credential.user.email,
    id: credential.user.id,
    name: credential.user.name,
    role: credential.user.role,
    status: credential.user.status,
    username: credential.user.username
  };
}
