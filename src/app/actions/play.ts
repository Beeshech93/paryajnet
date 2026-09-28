"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { assertCanPlay, userForAction } from "@/lib/auth";
import { playCasino, rotateSeed } from "@/lib/casino";
import { buyTicket } from "@/lib/lottery";
import { LOTTERY_TYPES } from "@/lib/lottery-rules";
import { parseAmount } from "@/lib/money";
import { placeSportsBet } from "@/lib/sports";
import { AppError } from "@/lib/types";
import { getActiveCurrency } from "@/lib/wallet";
import { run } from "./run";

async function player() {
  const user = await userForAction();
  assertCanPlay(user);
  return { user, currency: await getActiveCurrency(user, await getLocale()) };
}

function amount(value: unknown) {
  const parsed = parseAmount(value);
  if (!parsed) throw new AppError("invalid_amount");
  return parsed;
}

const slipSchema = z.object({
  stake: z.string(),
  legs: z.array(z.object({ selectionId: z.string(), odds: z.string() })),
});

export async function placeBetAction(input: z.infer<typeof slipSchema>) {
  return run(async () => {
    const { user, currency } = await player();
    const { stake, legs } = slipSchema.parse(input);
    const bet = await placeSportsBet(user.id, currency, amount(stake), legs);
    return { betId: bet.id };
  });
}

const ticketSchema = z.object({
  drawId: z.string(),
  lines: z.array(z.object({ type: z.enum(LOTTERY_TYPES), numbers: z.string(), stake: z.string() })),
});

export async function buyTicketAction(input: z.infer<typeof ticketSchema>) {
  return run(async () => {
    const { user, currency } = await player();
    const { drawId, lines } = ticketSchema.parse(input);
    const ticket = await buyTicket(
      user.id,
      currency,
      drawId,
      lines.map((l) => ({ ...l, stake: amount(l.stake) })),
    );
    return { ticketId: ticket.id };
  });
}

const casinoSchema = z.object({ game: z.enum(["DICE", "LIMBO"]), stake: z.string(), target: z.number() });

export async function playCasinoAction(input: z.infer<typeof casinoSchema>) {
  // No `run` here: skipping revalidation keeps rapid rounds snappy; the client
  // updates the balance from the returned value.
  try {
    const { user, currency } = await player();
    const { game, stake, target } = casinoSchema.parse(input);
    return { ok: true as const, data: await playCasino(user.id, currency, game, amount(stake), target) };
  } catch (err) {
    const { toActionError } = await import("@/lib/types");
    return toActionError(err);
  }
}

export async function rotateSeedAction(clientSeed: string) {
  return run(async () => {
    const user = await userForAction();
    await rotateSeed(user.id, clientSeed);
  });
}
