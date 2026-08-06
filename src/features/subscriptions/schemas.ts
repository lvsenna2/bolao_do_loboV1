import { z } from "zod";

export const startSubscriptionSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    paymentMethod: z.enum(["PIX", "CARD"]),
    plan: z.enum(["PRATA", "OURO", "PLATINUM"])
  })
  .strict();

export const subscriptionIdSchema = z.string().uuid();
