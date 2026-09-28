import { prisma, type Tx } from "./db";
import { CURRENCY_LIMITS, Decimal } from "./money";
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
import { AppError, type Currency, type Outcome } from "./types";
import { credit, debit, getOrCreateWallet } from "./wallet";

export type SlipLeg = { selectionId: string; odds: string };

/** In-play bets are held for this long, then re-checked, so late goals can't be exploited. */
export const LIVE_BET_DELAY_MS = Number(process.env.LIVE_BET_DELAY_MS ?? 5000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function bettable(event: { status: string; startsAt: Date }, now = new Date()) {
  return event.status === "LIVE" || (event.status === "SCHEDULED" && event.startsAt > now);
}

async function loadAndCheck(tx: Tx, slip: SlipLeg[]) {
  const selections = await tx.selection.findMany({
    where: { id: { in: slip.map((l) => l.selectionId) } },
    include: { market: { include: { event: true } } },
  });
  if (selections.length !== slip.length) throw new AppError("selection_unavailable");
  const eventIds = new Set(selections.map((s) => s.market.eventId));
  if (eventIds.size !== selections.length) throw new AppError("same_event_legs");
  for (const s of selections) {
    if (s.market.status !== "OPEN" || !bettable(s.market.event)) throw new AppError("selection_unavailable");
    const seen = slip.find((l) => l.selectionId === s.id)!;
    if (!s.odds.equals(new Decimal(seen.odds))) throw new AppError("odds_changed");
  }
  return selections;
}

export async function placeSportsBet(userId: string, currency: Currency, stake: Decimal, slip: SlipLeg[]) {
  const limits = CURRENCY_LIMITS[currency];
  if (slip.length === 0) throw new AppError("empty_slip");
  if (slip.length > MAX_LEGS) throw new AppError("too_many_legs", { max: MAX_LEGS });
  if (stake.lt(limits.minStake) || stake.gt(limits.maxStake)) {
    throw new AppError("stake_out_of_range", { min: limits.minStake, max: limits.maxStake });
  }

  const first = await loadAndCheck(prisma, slip);
  const totalOdds = combinedOdds(first.map((s) => s.odds));
  const potentialWin = stake.mul(totalOdds).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  if (potentialWin.gt(limits.maxPayout)) throw new AppError("max_payout", { max: limits.maxPayout });

  const live = first.some((s) => s.market.event.status === "LIVE");
  if (live) await sleep(LIVE_BET_DELAY_MS);

  return prisma.$transaction(async (tx) => {
    // Re-validate inside the transaction: odds, suspensions or kick-off may have changed.
    const selections = await loadAndCheck(tx, slip);
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
 * Create or update markets for an event. New selections are created, existing
 * ones get new prices; settled markets are never touched.
 */
export async function upsertMarkets(tx: Tx, eventId: string, markets: MarketDraft[], status?: "OPEN" | "SUSPENDED") {
  for (const m of markets) {
    checkDraft(m);
    const key = marketKey(m.type, m.line);
    const existing = await tx.market.findUnique({ where: { eventId_key: { eventId, key } } });
    if (existing?.status === "SETTLED") continue;
    const sort = (TYPE_ORDER.get(m.type as never) ?? 99) * 100 + (m.line ?? 0);
    const market =
      existing ??
      (await tx.market.create({
        data: { eventId, type: m.type, line: m.line === null ? null : new Decimal(m.line), key, sort },
      }));
    if (status && existing && existing.status !== status) {
      await tx.market.update({ where: { id: market.id }, data: { status } });
    }
    for (const s of m.selections) {
      await tx.selection.upsert({
        where: { marketId_code: { marketId: market.id, code: s.code } },
        create: { marketId: market.id, code: s.code, odds: new Decimal(s.odds) },
        update: { odds: new Decimal(s.odds) },
      });
    }
  }
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
  });
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
  });

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
