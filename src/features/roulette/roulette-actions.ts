"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/server/auth/session";
import { spinRoulette } from "./roulette-service";

const kindSchema = z.enum(["DAILY", "BONUS"]);

export async function spinRouletteAction(input: unknown) {
  const user = await requireUser();
  const parsed = kindSchema.safeParse(input);
  if (!parsed.success) return { message: "Tipo de giro invalido.", ok: false as const };
  try {
    const spin = await spinRoulette(user.id, parsed.data);
    revalidatePath("/roleta-diaria");
    revalidatePath("/carteira");
    revalidatePath("/dashboard");
    return {
      data: {
        jackpot: spin.prizeId === "jackpot",
        prizeId: spin.prizeId,
        prizeName: spin.prizeName
      },
      message: spin.prizeName,
      ok: true as const
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return {
      message:
        code === "ROULETTE_ALREADY_SPUN"
          ? "Giro de hoje ja utilizado."
          : code === "ROULETTE_NO_BONUS_SPIN"
            ? "Nenhum giro bonus disponivel."
            : "Nao foi possivel girar agora.",
      ok: false as const
    };
  }
}
