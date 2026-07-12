import {
  buildIntegrationAnnouncementEmail,
  buildPasswordResetEmail,
  buildWelcomeEmail
} from "@/features/auth/emails/auth-emails";
import { isEmailDeliveryConfigured, sendTransactionalEmail } from "@/server/email/resend";
import { prisma } from "@/server/db";

type UserEmailRecipient = {
  email: string;
  id: string;
  name: string | null;
};

type PasswordResetEmailInput = {
  email: string;
  expiresInMinutes: number;
  resetUrl: string;
  userName?: string | null;
};

const WELCOME_EMAIL_ACTION = "email.welcome.sent";
const INTEGRATION_ANNOUNCEMENT_ACTION = "email.integration_announcement.sent";

export function getPublicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput) {
  const appUrl = getPublicAppUrl();
  const email = buildPasswordResetEmail({
    appUrl,
    expiresInMinutes: input.expiresInMinutes,
    resetUrl: input.resetUrl,
    userName: input.userName
  });

  return sendTransactionalEmail({
    html: email.html,
    subject: email.subject,
    text: email.text,
    to: input.email
  });
}

export async function sendWelcomeEmailOnce(user: UserEmailRecipient) {
  if (!isEmailDeliveryConfigured()) {
    return {
      ok: false,
      skipped: true
    } as const;
  }

  const alreadySent = await prisma.auditLog.findFirst({
    where: {
      action: WELCOME_EMAIL_ACTION,
      entity: "User",
      entityId: user.id
    },
    select: {
      id: true
    }
  });

  if (alreadySent) {
    return {
      ok: true,
      skipped: true
    } as const;
  }

  const appUrl = getPublicAppUrl();
  const email = buildWelcomeEmail({
    appUrl,
    userName: user.name
  });
  const result = await sendTransactionalEmail({
    html: email.html,
    subject: email.subject,
    text: email.text,
    to: user.email
  });

  if (result.ok) {
    await prisma.auditLog.create({
      data: {
        action: WELCOME_EMAIL_ACTION,
        entity: "User",
        entityId: user.id,
        metadata: {
          emailId: result.id ?? null
        },
        userId: user.id
      }
    });
  }

  return {
    ok: result.ok,
    skipped: false
  } as const;
}

export async function sendIntegrationAnnouncementEmailOnce(
  adminId: string,
  user: UserEmailRecipient
) {
  const alreadySent = await prisma.auditLog.findFirst({
    where: {
      action: INTEGRATION_ANNOUNCEMENT_ACTION,
      entity: "User",
      entityId: user.id
    },
    select: {
      id: true
    }
  });

  if (alreadySent) {
    return "skipped" as const;
  }

  const appUrl = getPublicAppUrl();
  const email = buildIntegrationAnnouncementEmail({
    appUrl,
    userName: user.name
  });
  const result = await sendTransactionalEmail({
    html: email.html,
    subject: email.subject,
    text: email.text,
    to: user.email
  });

  if (!result.ok) {
    return "failed" as const;
  }

  await prisma.auditLog.create({
    data: {
      action: INTEGRATION_ANNOUNCEMENT_ACTION,
      entity: "User",
      entityId: user.id,
      metadata: {
        adminId,
        emailId: result.id ?? null
      },
      userId: user.id
    }
  });

  return "sent" as const;
}
