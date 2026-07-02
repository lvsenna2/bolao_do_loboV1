import type { AccountStatus, UserRole } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { loginSchema } from "@/features/auth/schemas/auth-schemas";
import { prisma } from "@/server/db";
import { verifyPassword } from "./password";

type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: UserRole;
  status: AccountStatus;
};

async function registerLoginAudit(userId: string, success: boolean) {
  await prisma.auditLog.create({
    data: {
      userId,
      action: success ? "auth.login.success" : "auth.login.failed",
      entity: "User",
      entityId: userId
    }
  });
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "E-mail e senha",
      credentials: {
        email: {
          label: "E-mail",
          type: "email"
        },
        password: {
          label: "Senha",
          type: "password"
        }
      },
      async authorize(credentials): Promise<AuthenticatedUser | null> {
        const parsedCredentials = loginSchema.safeParse(credentials);

        if (!parsedCredentials.success) {
          return null;
        }

        const user = await prisma.user.findFirst({
          where: {
            email: parsedCredentials.data.email,
            deletedAt: null
          },
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            passwordHash: true,
            role: true,
            status: true
          }
        });

        if (!user?.passwordHash) {
          return null;
        }

        const passwordMatches = await verifyPassword(
          parsedCredentials.data.password,
          user.passwordHash
        );

        if (!passwordMatches) {
          await registerLoginAudit(user.id, false);
          return null;
        }

        if (user.status === "BLOCKED" || user.status === "DELETED") {
          await registerLoginAudit(user.id, false);
          return null;
        }

        await prisma.user.update({
          where: {
            id: user.id
          },
          data: {
            lastLoginAt: new Date()
          }
        });

        await registerLoginAudit(user.id, true);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status
        };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.status = user.status;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.username = token.username;
        session.user.role = token.role;
        session.user.status = token.status;
      }

      return session;
    }
  }
};
