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
import { Decimal, LIMITS } from "./money";
import {
  isValidResult,
  linePayout,
  maxLinePayout,
  MAX_LINES,
  normalizeNumbers,
  type DrawResult,
  type LotteryType,
} from "./lottery-rules";
import { type Tx } from "./db";
import { ORDER_LEAD_MINUTES } from "./sports";
import { AppError } from "./types";

export type TicketLineInput = { type: LotteryType; numbers: string; stake: Decimal };

function checkLines(input: TicketLineInput[]) {
  if (input.length === 0) throw new AppError("empty_ticket");
  if (input.length > MAX_LINES) throw new AppError("too_many_lines", { max: MAX_LINES });
  const lines = input.map((l) => {
    const numbers = normalizeNumbers(l.type, l.numbers);
    if (!numbers) throw new AppError("invalid_numbers", { numbers: l.numbers });
    if (l.stake.lt(LIMITS.minStake) || l.stake.gt(LIMITS.maxStake)) {
      throw new AppError("stake_out_of_range", { min: LIMITS.minStake, max: LIMITS.maxStake });
    }
    return { type: l.type, numbers, stake: l.stake };
  });
  const maxWin = lines.reduce((acc, l) => acc.add(maxLinePayout(l.type, l.stake)), new Decimal(0));
  if (maxWin.gt(LIMITS.maxPayout)) throw new AppError("max_payout", { max: LIMITS.maxPayout });
  const totalStake = lines.reduce((acc, l) => acc.add(l.stake), new Decimal(0));
  return { lines, totalStake, maxWin };
}

/** Validate a ticket. `payBy` is the draw's betting close minus the lead time for paying. */
export async function quoteLotteryTicket(drawId: string, input: TicketLineInput[]) {
  const { lines, totalStake, maxWin } = checkLines(input);
  const draw = await prisma.lotteryDraw.findUnique({ where: { id: drawId } });
  const payBy = draw ? new Date(draw.closesAt.getTime() - ORDER_LEAD_MINUTES * 60_000) : null;
  if (!draw || draw.status !== "OPEN" || !payBy || payBy <= new Date()) throw new AppError("draw_closed");
  return { draw, lines, totalStake, maxWin, payBy };
}

export async function createTicketForOrder(tx: Tx, orderId: string, drawId: string, input: TicketLineInput[]) {
  const { lines, totalStake } = checkLines(input);
  const draw = await tx.lotteryDraw.findUnique({ where: { id: drawId } });
  if (!draw || draw.status !== "OPEN" || draw.closesAt <= new Date()) throw new AppError("draw_closed");
  return tx.lotteryTicket.create({ data: { orderId, drawId, totalStake, lines: { create: lines } } });
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

  // Only paid (confirmed) services are settled now; the rest are settled if an admin confirms them later.
  const tickets = await prisma.lotteryTicket.findMany({
    where: { drawId, status: "OPEN", order: { status: "CONFIRMED" } },
    select: { orderId: true },
  });
  const settled: string[] = [];
  for (const { orderId } of tickets) {
    if (await settleLotteryOrder(orderId)) settled.push(orderId);
  }
  if (settled.length) await (await import("./agent")).notifyResults(settled);
}

/** Settle a confirmed lottery service if its draw has results (or was cancelled). */
export async function settleLotteryOrder(orderId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.lotteryTicket.findUnique({
      where: { orderId },
      include: { lines: true, draw: true, order: true },
    });
    if (!ticket || ticket.status !== "OPEN" || ticket.order.status !== "CONFIRMED") return false;
    const { draw } = ticket;
    let status: "WON" | "LOST" | "VOID";
    let total = new Decimal(0);
    if (draw.status === "CANCELLED") {
      status = "VOID";
      total = ticket.totalStake;
      await tx.lotteryLine.updateMany({ where: { ticketId: ticket.id }, data: { result: "VOID" } });
    } else if (draw.status === "SETTLED" && draw.first && draw.second && draw.third) {
      const result = { first: draw.first, second: draw.second, third: draw.third };
      for (const line of ticket.lines) {
        const payout = linePayout(line.type as LotteryType, line.numbers, line.stake, result);
        total = total.add(payout);
        await tx.lotteryLine.update({
          where: { id: line.id },
          data: { payout, result: payout.gt(0) ? "WON" : "LOST" },
        });
      }
      status = total.gt(0) ? "WON" : "LOST";
    } else {
      return false;
    }
    const res = await tx.lotteryTicket.updateMany({
      where: { id: ticket.id, status: "OPEN" },
      data: { status, payout: total },
    });
    if (res.count === 0) return false;
    await tx.order.update({
      where: { id: orderId },
      data: { status, payout: status === "LOST" ? null : total, settledAt: new Date() },
    });
    return true;
  });
}

export async function cancelDraw(drawId: string) {
  const draw = await prisma.lotteryDraw.findUniqueOrThrow({ where: { id: drawId } });
  if (draw.status !== "OPEN") throw new AppError("already_settled");
  await prisma.lotteryDraw.update({ where: { id: drawId }, data: { status: "CANCELLED" } });
  const tickets = await prisma.lotteryTicket.findMany({
    where: { drawId, status: "OPEN", order: { status: "CONFIRMED" } },
    select: { orderId: true },
  });
  const settled: string[] = [];
  for (const { orderId } of tickets) {
    if (await settleLotteryOrder(orderId)) settled.push(orderId);
  }
  if (settled.length) await (await import("./agent")).notifyResults(settled);
}
