"use server";

import { getDatabaseErrorCode } from "@/server/db/errors";
import { prisma } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { addMinutes, createSecureToken } from "@/server/auth/tokens";
import { serverNow } from "@/lib/date-time";
import {
  getPublicAppUrl,
  sendPasswordResetEmail,
  sendWelcomeEmailOnce
} from "@/features/auth/services/auth-email-service";
import {
  forgotPasswordSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type RegisterInput,
  type ResetPasswordInput
} from "../schemas/auth-schemas";
import type { AuthActionResult } from "../types/auth-action-result";

const PASSWORD_RESET_IDENTIFIER_PREFIX = "password-reset:";
const PASSWORD_RESET_EXPIRATION_MINUTES = 30;

function normalizeFieldErrors(fieldErrors: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => {
      return Array.isArray(entry[1]) && entry[1].length > 0;
    })
  );
}

function createBirthDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createResetIdentifier(email: string) {
  return `${PASSWORD_RESET_IDENTIFIER_PREFIX}${email}`;
}

function getEmailFromResetIdentifier(identifier: string) {
  if (!identifier.startsWith(PASSWORD_RESET_IDENTIFIER_PREFIX)) {
    return null;
  }

  return identifier.slice(PASSWORD_RESET_IDENTIFIER_PREFIX.length);
}

function logPasswordResetUrl(resetUrl: string) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`Bolao do Lobo password reset: ${resetUrl}`);
  }
}

export async function registerUserAction(input: RegisterInput): Promise<AuthActionResult> {
  const parsedInput = registerSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise os dados informados.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const data = parsedInput.data;

  const existingUser = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [
        {
          email: {
            equals: data.email,
            mode: "insensitive"
          }
        },
        {
          username: {
            equals: data.username,
            mode: "insensitive"
          }
        }
      ]
    },
    select: {
      email: true,
      username: true
    }
  });

  if (existingUser) {
    const emailAlreadyExists = existingUser.email.toLowerCase() === data.email;
    const usernameAlreadyExists = existingUser.username.toLowerCase() === data.username;

    return {
      ok: false,
      message: "Ja existe uma conta com esses dados.",
      fieldErrors: {
        ...(emailAlreadyExists ? { email: ["Este e-mail ja esta em uso."] } : {}),
        ...(usernameAlreadyExists ? { username: ["Este username ja esta em uso."] } : {})
      }
    };
  }

  try {
    const passwordHash = await hashPassword(data.password);
    const now = serverNow();
    const name = `${data.firstName} ${data.lastName}`.trim();

    const user = await prisma.user.create({
      data: {
        name,
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        email: data.email,
        birthDate: createBirthDate(data.birthDate),
        passwordHash,
        status: "ACTIVE",
        termsAcceptedAt: now
      },
      select: {
        email: true,
        id: true,
        name: true
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "auth.register",
        entity: "User",
        entityId: user.id
      }
    });

    await sendWelcomeEmailOnce(user).catch(() => null);

    return {
      ok: true,
      message: "Conta criada com sucesso. Entre com seu e-mail e senha."
    };
  } catch (error) {
    if (getDatabaseErrorCode(error) === "UNIQUE_CONSTRAINT") {
      return {
        ok: false,
        message: "Ja existe uma conta com esses dados."
      };
    }

    return {
      ok: false,
      message: "Nao foi possivel criar a conta agora."
    };
  }
}

export async function requestPasswordResetAction(
  input: ForgotPasswordInput
): Promise<AuthActionResult> {
  const parsedInput = forgotPasswordSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Informe um e-mail valido.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const successResponse: AuthActionResult = {
    ok: true,
    message: "Se o e-mail estiver cadastrado, enviaremos as instrucoes de recuperacao."
  };

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: parsedInput.data.email,
        mode: "insensitive"
      },
      deletedAt: null
    },
    select: {
      name: true,
      id: true,
      email: true,
      status: true
    }
  });

  if (!user || user.status === "BLOCKED" || user.status === "DELETED") {
    return successResponse;
  }

  const token = createSecureToken();
  const identifier = createResetIdentifier(user.email);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({
      where: {
        identifier
      }
    }),
    prisma.verificationToken.create({
      data: {
        identifier,
        token,
        expires: addMinutes(serverNow(), PASSWORD_RESET_EXPIRATION_MINUTES)
      }
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "auth.password_reset.requested",
        entity: "User",
        entityId: user.id
      }
    })
  ]);

  const resetUrl = `${getPublicAppUrl()}/reset-password?token=${token}`;
  const emailResult = await sendPasswordResetEmail({
    email: user.email,
    expiresInMinutes: PASSWORD_RESET_EXPIRATION_MINUTES,
    resetUrl,
    userName: user.name
  });

  if (!emailResult.ok) {
    logPasswordResetUrl(resetUrl);

    return {
      ok: false,
      message: emailResult.message
    };
  }

  return successResponse;
}

export async function resetPasswordAction(input: ResetPasswordInput): Promise<AuthActionResult> {
  const parsedInput = resetPasswordSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise os dados informados.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const verificationToken = await prisma.verificationToken.findUnique({
    where: {
      token: parsedInput.data.token
    }
  });

  if (!verificationToken || verificationToken.expires < serverNow()) {
    return {
      ok: false,
      message: "O link de recuperacao expirou ou e invalido."
    };
  }

  const email = getEmailFromResetIdentifier(verificationToken.identifier);

  if (!email) {
    return {
      ok: false,
      message: "O link de recuperacao expirou ou e invalido."
    };
  }

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive"
      },
      deletedAt: null
    },
    select: {
      id: true
    }
  });

  if (!user) {
    return {
      ok: false,
      message: "O link de recuperacao expirou ou e invalido."
    };
  }

  const passwordHash = await hashPassword(parsedInput.data.password);

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        passwordHash
      }
    }),
    prisma.verificationToken.deleteMany({
      where: {
        identifier: verificationToken.identifier
      }
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "auth.password_reset.completed",
        entity: "User",
        entityId: user.id
      }
    })
  ]);

  return {
    ok: true,
    message: "Senha atualizada com sucesso. Entre novamente."
  };
}
