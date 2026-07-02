import type { AccountStatus, UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: UserRole;
      status: AccountStatus;
    } & DefaultSession["user"];
  }

  interface User {
    username: string;
    role: UserRole;
    status: AccountStatus;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: UserRole;
    status: AccountStatus;
  }
}
