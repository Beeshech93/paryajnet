import { prisma } from "./db";
import { CURRENCY_LIMITS, Decimal } from "./money";
import { combinedOdds, evaluateBet, MAX_LEGS, resolveSelection } from "./sports-rules";
import { AppError, type Currency, type Outcome } from "./types";
import { credit, debit, getOrCreateWallet } from "./wallet";

export type SlipLeg = { selectionId: string; odds: string };

export async function placeSportsBet(userId: string, currency: Currency, stake: Decimal, slip: SlipLeg[]) {
  const limits = CURRENCY_LIMITS[currency];
  if (slip.length === 0) throw new AppError("empty_slip");
  if (slip.length > MAX_LEGS) throw new AppError("too_many_legs", { max: MAX_LEGS });
  if (stake.lt(limits.minStake) || stake.gt(limits.maxStake)) {
    throw new AppError("stake_out_of_range", { min: limits.minStake, max: limits.maxStake });
  }

  const selections = await prisma.selection.findMany({
    where: { id: { in: slip.map((l) => l.selectionId) } },
    include: { market: { include: { event: true } } },
  });
  if (selections.length !== slip.length) throw new AppError("selection_unavailable");

  const eventIds = new Set(selections.map((s) => s.market.eventId));
  if (eventIds.size !== selections.length) throw new AppError("same_event_legs");

  const now = new Date();
  for (const s of selections) {
    const { market } = s;
    if (market.status !== "OPEN" || market.event.status !== "SCHEDULED" || market.event.startsAt <= now) {
      throw new AppError("selection_unavailable");
    }
    const seen = slip.find((l) => l.selectionId === s.id)!;
    if (!s.odds.equals(new Decimal(seen.odds))) throw new AppError("odds_changed");
  }

  const totalOdds = combinedOdds(selections.map((s) => s.odds));
  const potentialWin = stake.mul(totalOdds).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  if (potentialWin.gt(limits.maxPayout)) throw new AppError("max_payout", { max: limits.maxPayout });

  return prisma.$transaction(async (tx) => {
    const wallet = await getOrCreateWallet(userId, currency, tx);
    const bet = await tx.bet.create({
      data: {
        userId,
        walletId: wallet.id,
        currency,
        stake,
        totalOdds,
        potentialWin,
        legs: { create: selections.map((s) => ({ selectionId: s.id, odds: s.odds })) },
      },
    });
    await debit(tx, wallet.id, stake, "BET", `bet:${bet.id}`);
    return bet;
  });
}

/** Settle every market of an event from its final score, then the affected bets. */
export async function settleEvent(eventId: string, homeScore: number, awayScore: number) {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    include: { markets: { include: { selections: true } } },
  });
  if (event.status !== "SCHEDULED") throw new AppError("already_settled");

  await prisma.$transaction(async (tx) => {
    for (const market of event.markets) {
      for (const sel of market.selections) {
        await tx.selection.update({
          where: { id: sel.id },
          data: { result: resolveSelection(market.type, sel.code, homeScore, awayScore) },
        });
      }
      await tx.market.update({ where: { id: market.id }, data: { status: "SETTLED" } });
    }
    await tx.event.update({ where: { id: eventId }, data: { status: "SETTLED", homeScore, awayScore } });
  });

  await settleBetsTouching(event.markets.flatMap((m) => m.selections.map((s) => s.id)));
}

export async function cancelEvent(eventId: string) {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    include: { markets: { include: { selections: true } } },
  });
  if (event.status !== "SCHEDULED") throw new AppError("already_settled");
  const selectionIds = event.markets.flatMap((m) => m.selections.map((s) => s.id));
  await prisma.$transaction([
    prisma.selection.updateMany({ where: { id: { in: selectionIds } }, data: { result: "VOID" } }),
    prisma.market.updateMany({ where: { eventId }, data: { status: "SETTLED" } }),
    prisma.event.update({ where: { id: eventId }, data: { status: "CANCELLED" } }),
  ]);
  await settleBetsTouching(selectionIds);
}

async function settleBetsTouching(selectionIds: string[]) {
  const bets = await prisma.bet.findMany({
    where: { status: "OPEN", legs: { some: { selectionId: { in: selectionIds } } } },
    select: { id: true },
  });
  for (const { id } of bets) {
    await prisma.$transaction(async (tx) => {
      const bet = await tx.bet.findUniqueOrThrow({
        where: { id },
        include: { legs: { include: { selection: true } } },
      });
      if (bet.status !== "OPEN") return;
      for (const leg of bet.legs) {
        if (leg.result !== leg.selection.result) {
          await tx.betLeg.update({ where: { id: leg.id }, data: { result: leg.selection.result } });
        }
      }
      const { status, payout } = evaluateBet(
        bet.stake,
        bet.legs.map((l) => ({ odds: l.odds, result: l.selection.result as Outcome })),
      );
      if (status === "OPEN") return;
      // Guard against double settlement: only the transition from OPEN pays out.
      const res = await tx.bet.updateMany({
        where: { id, status: "OPEN" },
        data: { status, payout, settledAt: new Date() },
      });
      if (res.count === 1 && payout && payout.gt(0)) {
        await credit(tx, bet.walletId, payout, status === "VOID" ? "REFUND" : "WIN", `bet:${id}`);
      }
    });
  }
}
