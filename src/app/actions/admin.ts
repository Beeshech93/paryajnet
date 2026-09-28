"use server";

import { z } from "zod";
import { adminForAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cancelDraw, settleDraw } from "@/lib/lottery";
import { Decimal } from "@/lib/money";
import { approveWithdrawal, confirmDeposit, rejectDeposit, rejectWithdrawal } from "@/lib/payments";
import { cancelEvent, settleEvent } from "@/lib/sports";
import { MARKET_TYPES } from "@/lib/sports-rules";
import { AppError, type ActionResult } from "@/lib/types";
import { run } from "./run";

function asAdmin(fn: () => Promise<unknown>) {
  return run(async () => {
    await adminForAction();
    await fn();
  });
}

const odds = z.coerce.number().min(1.01).max(1000);

const eventSchema = z.object({
  sport: z.string().trim().min(1),
  league: z.string().trim().min(1),
  homeTeam: z.string().trim().min(1),
  awayTeam: z.string().trim().min(1),
  startsAt: z.coerce.date(),
  o1: odds,
  oX: odds,
  o2: odds,
  oOver: odds,
  oUnder: odds,
  oYes: odds,
  oNo: odds,
});

export async function createEventAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const parsed = eventSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) throw new AppError("invalid_form");
    const d = parsed.data;
    if (d.startsAt <= new Date()) throw new AppError("start_in_past");
    const priceFor: Record<string, number> = {
      "1": d.o1,
      X: d.oX,
      "2": d.o2,
      OVER: d.oOver,
      UNDER: d.oUnder,
      YES: d.oYes,
      NO: d.oNo,
    };
    await prisma.event.create({
      data: {
        sport: d.sport,
        league: d.league,
        homeTeam: d.homeTeam,
        awayTeam: d.awayTeam,
        startsAt: d.startsAt,
        markets: {
          create: Object.entries(MARKET_TYPES).map(([type, codes]) => ({
            type,
            selections: { create: codes.map((code) => ({ code, odds: new Decimal(priceFor[code]) })) },
          })),
        },
      },
    });
  });
}

export async function settleEventAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const home = Number(form.get("homeScore"));
    const away = Number(form.get("awayScore"));
    if (![home, away].every((n) => Number.isInteger(n) && n >= 0 && n < 100)) throw new AppError("invalid_score");
    await settleEvent(String(form.get("eventId")), home, away);
  });
}

export async function cancelEventAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    await cancelEvent(String(form.get("eventId")));
  });
}

export async function updateOddsAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const id = String(form.get("selectionId"));
    const value = odds.safeParse(form.get("odds"));
    if (!value.success) throw new AppError("invalid_odds");
    await prisma.selection.update({ where: { id }, data: { odds: new Decimal(value.data) } });
  });
}

export async function toggleMarketAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const market = await prisma.market.findUniqueOrThrow({ where: { id: String(form.get("marketId")) } });
    if (market.status === "SETTLED") throw new AppError("already_settled");
    await prisma.market.update({
      where: { id: market.id },
      data: { status: market.status === "OPEN" ? "SUSPENDED" : "OPEN" },
    });
  });
}

export async function createDrawAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const name = String(form.get("name") ?? "").trim();
    const closesAt = new Date(String(form.get("closesAt")));
    if (!name || Number.isNaN(closesAt.getTime())) throw new AppError("invalid_form");
    if (closesAt <= new Date()) throw new AppError("start_in_past");
    await prisma.lotteryDraw.create({ data: { name, closesAt } });
  });
}

export async function settleDrawAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    await settleDraw(String(form.get("drawId")), {
      first: String(form.get("first") ?? "").trim(),
      second: String(form.get("second") ?? "").trim(),
      third: String(form.get("third") ?? "").trim(),
    });
  });
}

export async function cancelDrawAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    await cancelDraw(String(form.get("drawId")));
  });
}

export async function paymentDecisionAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const id = String(form.get("paymentId"));
    const decision = String(form.get("decision"));
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id } });
    if (payment.kind === "DEPOSIT") {
      await (decision === "approve" ? confirmDeposit(id) : rejectDeposit(id));
    } else {
      await (decision === "approve" ? approveWithdrawal(id) : rejectWithdrawal(id));
    }
  });
}
