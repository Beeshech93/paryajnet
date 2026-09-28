import { randomUUID } from "node:crypto";
import { mapLimit } from "./concurrency";
import { prisma, type Tx } from "./db";
import { Decimal, LIMITS } from "./money";
import type { MarketDraft } from "./pricing";
import {
  combinedOdds,
  evaluateBet,
  MARKET_TYPES,
  marketKey,
  MAX_LEGS,
  resolveSelection,
  validateMarket,
} from "./sports-rules";
import { AppError, type Outcome } from "./types";

export type SlipLeg = { selectionId: string; odds: string };

/** Market-wide writes touch dozens of rows; give them more than Prisma's 5s default. */
export const LONG_TX = { maxWait: 10_000, timeout: 30_000 };

/** Customers need time to pay before kick-off: services close this long before the first game. */
export const ORDER_LEAD_MINUTES = Number(process.env.ORDER_LEAD_MINUTES ?? 10);

async function loadAndCheck(tx: Tx, slip: SlipLeg[]) {
  const selections = await tx.selection.findMany({
    where: { id: { in: slip.map((l) => l.selectionId) } },
    include: { market: { include: { event: true } } },
  });
  if (selections.length !== slip.length) throw new AppError("selection_unavailable");
  const eventIds = new Set(selections.map((s) => s.market.eventId));
  if (eventIds.size !== selections.length) throw new AppError("same_event_legs");
  const cutoff = new Date(Date.now() + ORDER_LEAD_MINUTES * 60_000);
  for (const s of selections) {
    const e = s.market.event;
    // Pre-match only: payment is confirmed by hand, so in-play betting isn't offered.
    if (s.market.status !== "OPEN" || e.status !== "SCHEDULED" || e.startsAt <= cutoff) {
      throw new AppError("selection_unavailable");
    }
    const seen = slip.find((l) => l.selectionId === s.id)!;
    if (!s.odds.equals(new Decimal(seen.odds))) throw new AppError("odds_changed");
  }
  return selections;
}

/** Validate a bet slip and price it. `payBy` is the first kick-off minus the lead time. */
export async function quoteSportsBet(stake: Decimal, slip: SlipLeg[]) {
  if (slip.length === 0) throw new AppError("empty_slip");
  if (slip.length > MAX_LEGS) throw new AppError("too_many_legs", { max: MAX_LEGS });
  if (stake.lt(LIMITS.minStake) || stake.gt(LIMITS.maxStake)) {
    throw new AppError("stake_out_of_range", { min: LIMITS.minStake, max: LIMITS.maxStake });
  }
  const selections = await loadAndCheck(prisma, slip);
  const totalOdds = combinedOdds(selections.map((s) => s.odds));
  const potentialWin = stake.mul(totalOdds).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  if (potentialWin.gt(LIMITS.maxPayout)) throw new AppError("max_payout", { max: LIMITS.maxPayout });
  const firstStart = Math.min(...selections.map((s) => s.market.event.startsAt.getTime()));
  return { selections, totalOdds, potentialWin, payBy: new Date(firstStart - ORDER_LEAD_MINUTES * 60_000) };
}

/** Create the bet for a service inside the order's transaction (re-validates odds and availability). */
export async function createBetForOrder(tx: Tx, orderId: string, stake: Decimal, slip: SlipLeg[]) {
  const selections = await loadAndCheck(tx, slip);
  const totalOdds = combinedOdds(selections.map((s) => s.odds));
  return tx.bet.create({
    data: {
      orderId,
      stake,
      totalOdds,
      potentialWin: stake.mul(totalOdds).toDecimalPlaces(2, Decimal.ROUND_DOWN),
      legs: { create: selections.map((s) => ({ selectionId: s.id, odds: s.odds })) },
    },
  });
}

// ---------- Event management (admin, odds feed, seed) ----------

export type EventInput = {
  externalId?: string | null;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date;
  markets: MarketDraft[];
};

function checkDraft(m: MarketDraft) {
  const err = validateMarket(
    m.type,
    m.line,
    m.selections.map((s) => s.code),
  );
  if (err) throw new AppError(err);
  for (const s of m.selections) {
    if (!(s.odds >= 1.01 && s.odds <= 1000)) throw new AppError("invalid_odds");
  }
}

const TYPE_ORDER = new Map(MARKET_TYPES.map((t, i) => [t, i]));

/**
 * Create or update markets for an event with few round trips: one read, then
 * bulk inserts for new markets/selections and updates only for odds that
 * changed. Settled markets are never touched. `db` can be a transaction.
 */
export async function upsertMarkets(db: Tx, eventId: string, markets: MarketDraft[], status?: "OPEN" | "SUSPENDED") {
  markets.forEach(checkDraft);
  const keys = markets.map((m) => marketKey(m.type, m.line));
  const existing = await db.market.findMany({ where: { eventId, key: { in: keys } }, include: { selections: true } });
  const byKey = new Map(existing.map((m) => [m.key, m]));
  const newMarkets: { id: string; eventId: string; type: string; line: Decimal | null; key: string; sort: number }[] =
    [];
  const newSelections: { marketId: string; code: string; odds: Decimal }[] = [];
  const updates: { id: string; odds: Decimal }[] = [];
  const statusChanges: string[] = [];

  markets.forEach((m, idx) => {
    const key = keys[idx];
    const ex = byKey.get(key);
    if (ex?.status === "SETTLED") return;
    if (!ex) {
      const id = randomUUID();
      newMarkets.push({
        id,
        eventId,
        type: m.type,
        line: m.line === null ? null : new Decimal(m.line),
        key,
        sort: (TYPE_ORDER.get(m.type as never) ?? 99) * 100 + (m.line ?? 0),
      });
      for (const sel of m.selections) newSelections.push({ marketId: id, code: sel.code, odds: new Decimal(sel.odds) });
      return;
    }
    if (status && ex.status !== status) statusChanges.push(ex.id);
    const current = new Map(ex.selections.map((sel) => [sel.code, sel]));
    for (const sel of m.selections) {
      const odds = new Decimal(sel.odds);
      const cur = current.get(sel.code);
      if (!cur) newSelections.push({ marketId: ex.id, code: sel.code, odds });
      else if (!cur.odds.equals(odds)) updates.push({ id: cur.id, odds });
    }
  });

  if (newMarkets.length) await db.market.createMany({ data: newMarkets });
  if (newSelections.length) await db.selection.createMany({ data: newSelections });
  if (statusChanges.length)
    await db.market.updateMany({ where: { id: { in: statusChanges } }, data: { status: status! } });
  await mapLimit(updates, 8, (u) => db.selection.update({ where: { id: u.id }, data: { odds: u.odds } }));
  return { created: newMarkets.length, updated: updates.length };
}

export async function createEvent(input: EventInput) {
  input.markets.forEach(checkDraft);
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        externalId: input.externalId ?? null,
        sport: input.sport,
        league: input.league,
        homeTeam: input.homeTeam,
        awayTeam: input.awayTeam,
        startsAt: input.startsAt,
      },
    });
    await upsertMarkets(tx, event.id, input.markets);
    return event;
  }, LONG_TX);
}

export async function startLive(eventId: string) {
  const res = await prisma.event.updateMany({
    where: { id: eventId, status: "SCHEDULED" },
    data: { status: "LIVE", homeScore: 0, awayScore: 0, clock: "0'" },
  });
  if (res.count === 0) throw new AppError("already_settled");
}

/**
 * Update the live score. A change in score suspends every open market until
 * a trader (or the feed) reprices and reopens them.
 */
export async function updateLive(eventId: string, homeScore: number, awayScore: number, clock: string | null) {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  if (event.status !== "LIVE") throw new AppError("not_live");
  const scoreChanged = event.homeScore !== homeScore || event.awayScore !== awayScore;
  await prisma.$transaction([
    prisma.event.update({ where: { id: eventId }, data: { homeScore, awayScore, clock } }),
    ...(scoreChanged
      ? [prisma.market.updateMany({ where: { eventId, status: "OPEN" }, data: { status: "SUSPENDED" } })]
      : []),
  ]);
}

export async function setAllMarkets(eventId: string, status: "OPEN" | "SUSPENDED") {
  await prisma.market.updateMany({ where: { eventId, status: { not: "SETTLED" } }, data: { status } });
}

// ---------- Settlement ----------

/** Settle every market of an event from its final score, then the affected bets. */
export async function settleEvent(eventId: string, homeScore: number, awayScore: number) {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    include: { markets: { include: { selections: true } } },
  });
  if (event.status !== "SCHEDULED" && event.status !== "LIVE") throw new AppError("already_settled");

  await prisma.$transaction(async (tx) => {
    for (const market of event.markets) {
      const info = { type: market.type, line: market.line, codes: market.selections.map((s) => s.code) };
      for (const sel of market.selections) {
        await tx.selection.update({
          where: { id: sel.id },
          data: { result: resolveSelection(info, sel.code, homeScore, awayScore) },
        });
      }
      await tx.market.update({ where: { id: market.id }, data: { status: "SETTLED" } });
    }
    await tx.event.update({ where: { id: eventId }, data: { status: "SETTLED", homeScore, awayScore, clock: null } });
  }, LONG_TX);

  await settleBetsTouching(event.markets.flatMap((m) => m.selections.map((s) => s.id)));
}

export async function cancelEvent(eventId: string) {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    include: { markets: { include: { selections: true } } },
  });
  if (event.status !== "SCHEDULED" && event.status !== "LIVE") throw new AppError("already_settled");
  const selectionIds = event.markets.flatMap((m) => m.selections.map((s) => s.id));
  await prisma.$transaction([
    prisma.selection.updateMany({ where: { id: { in: selectionIds } }, data: { result: "VOID" } }),
    prisma.market.updateMany({ where: { eventId }, data: { status: "SETTLED" } }),
    prisma.event.update({ where: { id: eventId }, data: { status: "CANCELLED", clock: null } }),
  ]);
  await settleBetsTouching(selectionIds);
}

async function settleBetsTouching(selectionIds: string[]) {
  // Only paid (confirmed) services are settled. Unconfirmed ones stay open: if the
  // receipt arrived on time, confirming them later settles them straight away.
  const bets = await prisma.bet.findMany({
    where: { status: "OPEN", order: { status: "CONFIRMED" }, legs: { some: { selectionId: { in: selectionIds } } } },
    select: { orderId: true },
  });
  const settled: string[] = [];
  for (const { orderId } of bets) {
    if (await settleSportsOrder(orderId)) settled.push(orderId);
  }
  if (settled.length) await (await import("./agent")).notifyResults(settled);
}

/** Settle a confirmed sports service if all its games are decided. Returns true when it was settled now. */
export async function settleSportsOrder(orderId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const bet = await tx.bet.findUnique({
      where: { orderId },
      include: { legs: { include: { selection: true } }, order: true },
    });
    if (!bet || bet.status !== "OPEN" || bet.order.status !== "CONFIRMED") return false;
    for (const leg of bet.legs) {
      if (leg.result !== leg.selection.result) {
        await tx.betLeg.update({ where: { id: leg.id }, data: { result: leg.selection.result } });
      }
    }
    const { status, payout } = evaluateBet(
      bet.stake,
      bet.legs.map((l) => ({ odds: l.odds, result: l.selection.result as Outcome })),
    );
    if (status === "OPEN") return false;
    // Guard against double settlement: only the transition from OPEN counts.
    const res = await tx.bet.updateMany({
      where: { id: bet.id, status: "OPEN" },
      data: { status, payout, settledAt: new Date() },
    });
    if (res.count === 0) return false;
    await tx.order.update({
      where: { id: orderId },
      data: { status, payout: status === "LOST" ? null : payout, settledAt: new Date() },
    });
    return true;
  });
}
