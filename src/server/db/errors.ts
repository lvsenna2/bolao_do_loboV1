import { Prisma } from "@prisma/client";

export type DatabaseErrorCode =
  "UNIQUE_CONSTRAINT" | "FOREIGN_KEY_CONSTRAINT" | "RECORD_NOT_FOUND" | "UNKNOWN_DATABASE_ERROR";

export function getDatabaseErrorCode(error: unknown): DatabaseErrorCode {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "UNIQUE_CONSTRAINT";
    }

    if (error.code === "P2003") {
      return "FOREIGN_KEY_CONSTRAINT";
    }

    if (error.code === "P2025") {
      return "RECORD_NOT_FOUND";
    }
  }

  return "UNKNOWN_DATABASE_ERROR";
}
