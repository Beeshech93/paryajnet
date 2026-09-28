"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { LOTTERY_TYPES } from "@/lib/lottery-rules";
import { createOrder } from "@/lib/orders";
import { AppError } from "@/lib/types";
import { run } from "./run";

const customer = {
  customerName: z.string().max(80),
  phone: z.string().max(30),
  adult: z.literal(true),
};

const schema = z.discriminatedUnion("kind", [
  z.object({
    ...customer,
    kind: z.literal("SPORTS"),
    stake: z.string(),
    legs: z.array(z.object({ selectionId: z.string(), odds: z.string() })).max(20),
  }),
  z.object({
    ...customer,
    kind: z.literal("LOTTERY"),
    drawId: z.string(),
    lines: z.array(z.object({ type: z.enum(LOTTERY_TYPES), numbers: z.string(), stake: z.string() })).max(20),
  }),
]);

/** Public: a customer (no account) creates a service; the WhatsApp agent sends the payment details. */
export async function createOrderAction(input: z.input<typeof schema>) {
  return run(async () => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      if (parsed.error.issues.some((i) => i.path[0] === "adult")) throw new AppError("adult_required");
      throw new AppError("invalid_form");
    }
    const order = await createOrder({ ...parsed.data, locale: await getLocale() });
    return { code: order.code };
  });
}
