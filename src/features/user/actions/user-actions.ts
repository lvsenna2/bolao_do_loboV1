"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/server/auth/session";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import {
  deleteAccountSchema,
  notificationIdSchema,
  updatePasswordSchema,
  updateProfileSchema,
  type DeleteAccountInput,
  type UpdatePasswordInput,
  type UpdateProfileInput
} from "../schemas/user-schemas";
import type { UserActionResult } from "../types/user-action-result";

function normalizeFieldErrors(fieldErrors: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => {
      return Array.isArray(entry[1]) && entry[1].length > 0;
    })
  );
}

function revalidateUserArea() {
  revalidatePath("/dashboard");
  revalidatePath("/perfil");
  revalidatePath("/ligas");
  revalidatePath("/minhas-ligas");
  revalidatePath("/notificacoes");
  revalidatePath("/conquistas");
  revalidatePath("/estatisticas");
}

async function createUserAuditLog(
  userId: string,
  action: string,
  oldValue?: unknown,
  newValue?: unknown
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity: "User",
      entityId: userId,
      oldValue: oldValue === undefined ? undefined : JSON.parse(JSON.stringify(oldValue)),
      newValue: newValue === undefined ? undefined : JSON.parse(JSON.stringify(newValue))
    }
  });
}

export async function updateProfileAction(input: UpdateProfileInput): Promise<UserActionResult> {
  const sessionUser = await requireUser();
  const parsedInput = updateProfileSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise os dados do perfil.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const data = parsedInput.data;
  const existingUsername = await prisma.user.findFirst({
    where: {
      username: data.username,
      NOT: {
        id: sessionUser.id
      }
    },
    select: {
      id: true
    }
  });

  if (existingUsername) {
    return {
      ok: false,
      message: "Este username ja esta em uso.",
      fieldErrors: {
        username: ["Este username ja esta em uso."]
      }
    };
  }

  const currentUser = await prisma.user.findUnique({
    where: {
      id: sessionUser.id
    },
    select: {
      firstName: true,
      lastName: true,
      username: true,
      avatarUrl: true,
      locale: true,
      theme: true
    }
  });

  const name = `${data.firstName} ${data.lastName}`.trim();

  await prisma.user.update({
    where: {
      id: sessionUser.id
    },
    data: {
      avatarUrl: data.avatarUrl || null,
      firstName: data.firstName,
      lastName: data.lastName,
      locale: data.locale,
      name,
      theme: data.theme,
      username: data.username
    }
  });

  await createUserAuditLog(sessionUser.id, "user.profile.updated", currentUser, data);
  revalidateUserArea();

  return {
    ok: true,
    message: "Perfil atualizado."
  };
}

export async function updatePasswordAction(input: UpdatePasswordInput): Promise<UserActionResult> {
  const sessionUser = await requireUser();
  const parsedInput = updatePasswordSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Revise os dados da senha.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      id: sessionUser.id
    },
    select: {
      id: true,
      passwordHash: true
    }
  });

  if (!user?.passwordHash) {
    return {
      ok: false,
      message: "Nao foi possivel validar sua senha atual."
    };
  }

  const passwordMatches = await verifyPassword(parsedInput.data.currentPassword, user.passwordHash);

  if (!passwordMatches) {
    return {
      ok: false,
      message: "Senha atual incorreta.",
      fieldErrors: {
        currentPassword: ["Senha atual incorreta."]
      }
    };
  }

  const passwordHash = await hashPassword(parsedInput.data.password);

  await prisma.user.update({
    where: {
      id: sessionUser.id
    },
    data: {
      passwordHash
    }
  });

  await createUserAuditLog(sessionUser.id, "user.password.updated");

  return {
    ok: true,
    message: "Senha atualizada."
  };
}

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const sessionUser = await requireUser();
  const parsedInput = notificationIdSchema.safeParse({
    notificationId: formData.get("notificationId")
  });

  if (!parsedInput.success) {
    return;
  }

  await prisma.notification.updateMany({
    where: {
      id: parsedInput.data.notificationId,
      userId: sessionUser.id
    },
    data: {
      isRead: true,
      readAt: serverNow()
    }
  });

  revalidatePath("/notificacoes");
}

export async function markAllNotificationsReadAction(formData: FormData): Promise<void> {
  const sessionUser = await requireUser();
  const filter = formData.get("filter");

  await prisma.notification.updateMany({
    where: {
      ...(filter === "xp" ? { type: "XP" as const } : {}),
      isRead: false,
      userId: sessionUser.id
    },
    data: {
      isRead: true,
      readAt: serverNow()
    }
  });

  revalidatePath("/notificacoes");
}

export async function deleteOwnAccountAction(input: DeleteAccountInput): Promise<UserActionResult> {
  const sessionUser = await requireUser();
  const parsedInput = deleteAccountSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      message: "Confirmacao invalida.",
      fieldErrors: normalizeFieldErrors(parsedInput.error.flatten().fieldErrors)
    };
  }

  await prisma.user.update({
    where: {
      id: sessionUser.id
    },
    data: {
      deletedAt: serverNow(),
      status: "DELETED"
    }
  });

  await createUserAuditLog(sessionUser.id, "user.account.deleted");

  return {
    ok: true,
    message: "Conta marcada para exclusao."
  };
}
