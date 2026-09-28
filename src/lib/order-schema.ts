import { z } from "zod";
import { LOTTERY_TYPES } from "./lottery-rules";

const customer = {
  customerName: z.string().max(80),
  phone: z.string().max(30),
  adult: z.literal(true),
};

/** A new service as sent by the bet slip / ticket builder (online or cash sale). */
export const orderInputSchema = z.discriminatedUnion("kind", [
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

export type OrderInput = z.input<typeof orderInputSchema>;
