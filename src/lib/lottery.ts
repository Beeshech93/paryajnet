import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import {
  LOTTERIES,
  resultFromPicks,
  upcomingDraws,
  zonedToUtc,
  type LotteryCode,
  type SessionCode,
} from "./lottery-schedule";
import { CURRENCY_LIMITS, Decimal } from "./money";
import {
  isValidResult,
  linePayout,
  maxLinePayout,
  MAX_LINES,
  normalizeNumbers,
  type DrawResult,
  type LotteryType,
} from "./lottery-rules";
import { AppError, type Currency } from "./types";
import { credit, debit, getOrCreateWallet } from "./wallet";

export type TicketLineInput = { type: LotteryType; numbers: string; stake: Decimal };

export async function buyTicket(userId: string, currency: Currency, drawId: string, input: TicketLineInput[]) {
  const limits = CURRENCY_LIMITS[currency];
  if (input.length === 0) throw new AppError("empty_ticket");
  if (input.length > MAX_LINES) throw new AppError("too_many_lines", { max: MAX_LINES });

  const lines = input.map((l) => {
    const numbers = normalizeNumbers(l.type, l.numbers);
    if (!numbers) throw new AppError("invalid_numbers", { numbers: l.numbers });
    if (l.stake.lt(limits.minStake) || l.stake.gt(limits.maxStake)) {
      throw new AppError("stake_out_of_range", { min: limits.minStake, max: limits.maxStake });
    }
    return { type: l.type, numbers, stake: l.stake };
  });

  const maxWin = lines.reduce((acc, l) => acc.add(maxLinePayout(l.type, l.stake)), new Decimal(0));
  if (maxWin.gt(limits.maxPayout)) throw new AppError("max_payout", { max: limits.maxPayout });

  const totalStake = lines.reduce((acc, l) => acc.add(l.stake), new Decimal(0));

  return prisma.$transaction(async (tx) => {
    const draw = await tx.lotteryDraw.findUnique({ where: { id: drawId } });
    if (!draw || draw.status !== "OPEN" || draw.closesAt <= new Date()) throw new AppError("draw_closed");
    const wallet = await getOrCreateWallet(userId, currency, tx);
    const ticket = await tx.lotteryTicket.create({
      data: { userId, walletId: wallet.id, drawId, currency, totalStake, lines: { create: lines } },
    });
    await debit(tx, wallet.id, totalStake, "BET", `ticket:${ticket.id}`);
    return ticket;
  });
}

/** Create any missing scheduled state draws (idempotent; safe to call on every page load). */
export async function ensureUpcomingDraws(now = new Date()) {
  const scheduled = upcomingDraws(now);
  const existing = await prisma.lotteryDraw.findMany({
    where: { lottery: { not: null }, drawAt: { gte: now } },
    select: { lottery: true, session: true, drawAt: true },
  });
  const have = new Set(existing.map((d) => `${d.lottery}|${d.session}|${d.drawAt?.getTime()}`));
  for (const d of scheduled) {
    if (have.has(`${d.lottery}|${d.session}|${d.drawAt.getTime()}`)) continue;
    try {
      await prisma.lotteryDraw.create({
        data: { ...d, name: `${LOTTERIES[d.lottery].name} · ${d.session}` },
      });
    } catch (err) {
      // A concurrent request created it first (unique constraint) — fine.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    }
  }
}

/** Settle a state draw from the official Pick 3 and Pick 4 numbers. */
export async function settleWithPicks(drawId: string, pick3: string, pick4: string) {
  const result = resultFromPicks(pick3.trim(), pick4.trim());
  if (!result) throw new AppError("invalid_picks");
  await settleDraw(drawId, result, { pick3: pick3.trim(), pick4: pick4.trim() });
}

/** Find a scheduled draw by state, session and Eastern-Time date (for results feeds). */
export async function findStateDraw(lottery: LotteryCode, session: SessionCode, ymd: string) {
  const hm = (LOTTERIES[lottery].sessions as Record<string, string>)[session];
  if (!hm) return null;
  return prisma.lotteryDraw.findUnique({
    where: { lottery_session_drawAt: { lottery, session, drawAt: zonedToUtc(ymd, hm) } },
  });
}

export async function settleDraw(drawId: string, result: DrawResult, picks?: { pick3: string; pick4: string }) {
  if (!isValidResult(result)) throw new AppError("invalid_result");
  const draw = await prisma.lotteryDraw.findUniqueOrThrow({ where: { id: drawId } });
  if (draw.status !== "OPEN") throw new AppError("already_settled");
  if (draw.drawAt && draw.drawAt > new Date()) throw new AppError("draw_not_held");

  await prisma.lotteryDraw.update({ where: { id: drawId }, data: { status: "SETTLED", ...result, ...picks } });

  const tickets = await prisma.lotteryTicket.findMany({ where: { drawId, status: "OPEN" }, select: { id: true } });
  for (const { id } of tickets) {
    await prisma.$transaction(async (tx) => {
      const ticket = await tx.lotteryTicket.findUniqueOrThrow({ where: { id }, include: { lines: true } });
      let total = new Decimal(0);
      for (const line of ticket.lines) {
        const payout = linePayout(line.type as LotteryType, line.numbers, line.stake, result);
        total = total.add(payout);
        await tx.lotteryLine.update({
          where: { id: line.id },
          data: { payout, result: payout.gt(0) ? "WON" : "LOST" },
        });
      }
      const status = total.gt(0) ? "WON" : "LOST";
      const res = await tx.lotteryTicket.updateMany({ where: { id, status: "OPEN" }, data: { status, payout: total } });
      if (res.count === 1) await credit(tx, ticket.walletId, total, "WIN", `ticket:${id}`);
    });
  }
}

export async function cancelDraw(drawId: string) {
  const draw = await prisma.lotteryDraw.findUniqueOrThrow({ where: { id: drawId } });
  if (draw.status !== "OPEN") throw new AppError("already_settled");
  await prisma.lotteryDraw.update({ where: { id: drawId }, data: { status: "CANCELLED" } });
  const tickets = await prisma.lotteryTicket.findMany({ where: { drawId, status: "OPEN" } });
  for (const t of tickets) {
    await prisma.$transaction(async (tx) => {
      const res = await tx.lotteryTicket.updateMany({
        where: { id: t.id, status: "OPEN" },
        data: { status: "VOID", payout: t.totalStake },
      });
      await tx.lotteryLine.updateMany({ where: { ticketId: t.id }, data: { result: "VOID" } });
      if (res.count === 1) await credit(tx, t.walletId, t.totalStake, "REFUND", `ticket:${t.id}`);
    });
  }
}
