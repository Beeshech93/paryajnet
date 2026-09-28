"use server";

import { z } from "zod";
import { adminForAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cancelDraw, settleDraw, settleWithPicks } from "@/lib/lottery";
import { Decimal } from "@/lib/money";
import { approveWithdrawal, confirmDeposit, rejectDeposit, rejectWithdrawal } from "@/lib/payments";
import { reviewKyc } from "@/lib/kyc";
import { basketballMarkets, footballMarkets } from "@/lib/pricing";
import {
  cancelEvent,
  createEvent,
  settleEvent,
  setAllMarkets,
  startLive,
  updateLive,
  upsertMarkets,
} from "@/lib/sports";
import { AppError, type ActionResult } from "@/lib/types";
import { run } from "./run";

function asAdmin(fn: () => Promise<unknown>) {
  return run(async () => {
    await adminForAction();
    await fn();
  });
}

const odds = z.coerce.number().min(1.01).max(1000);

const baseEvent = {
  league: z.string().trim().min(1).max(100),
  homeTeam: z.string().trim().min(1).max(100),
  awayTeam: z.string().trim().min(1).max(100),
  startsAt: z.coerce.date(),
};
const footballSchema = z.object({
  ...baseEvent,
  sport: z.literal("football"),
  o1: odds,
  oX: odds,
  o2: odds,
  oOver: odds,
  oUnder: odds,
  oYes: odds,
  oNo: odds,
});
const halfLine = z.coerce.number().refine((n) => Number.isFinite(n) && Math.round(n * 2) === n * 2);
const basketballSchema = z.object({
  ...baseEvent,
  sport: z.literal("basketball"),
  ml1: odds,
  ml2: odds,
  spread: halfLine,
  total: halfLine.refine((n) => n > 0),
});

export async function createEventAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const raw = Object.fromEntries(form);
    const parsed = z.discriminatedUnion("sport", [footballSchema, basketballSchema]).safeParse(raw);
    if (!parsed.success) throw new AppError("invalid_form");
    const d = parsed.data;
    if (d.startsAt <= new Date()) throw new AppError("start_in_past");
    const markets =
      d.sport === "football"
        ? footballMarkets({ odds1X2: [d.o1, d.oX, d.o2], oddsOU25: [d.oOver, d.oUnder], oddsBTTS: [d.oYes, d.oNo] })
        : basketballMarkets({ oddsML: [d.ml1, d.ml2], spread: d.spread, total: d.total });
    await createEvent({ ...d, markets });
  });
}

/** Add (or reprice) a market. Selections are entered one per line as "code=odds". */
export async function addMarketAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const eventId = String(form.get("eventId"));
    const type = String(form.get("type"));
    const lineRaw = String(form.get("line") ?? "")
      .trim()
      .replace(",", ".");
    const line = lineRaw === "" ? null : Number(lineRaw);
    const selections = String(form.get("selections") ?? "")
      .split(/[\n,;]+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [code, price] = l.split(/\s*[=:]\s*/);
        return { code: code?.trim().toUpperCase(), odds: Number(price?.replace(",", ".")) };
      });
    if (selections.some((s) => !s.code || !Number.isFinite(s.odds))) throw new AppError("invalid_market");
    const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    if (event.status !== "SCHEDULED" && event.status !== "LIVE") throw new AppError("already_settled");
    await prisma.$transaction((tx) => upsertMarkets(tx, eventId, [{ type, line, selections }]));
  });
}

export async function startLiveAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(() => startLive(String(form.get("eventId"))));
}

export async function updateLiveAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const home = Number(form.get("homeScore"));
    const away = Number(form.get("awayScore"));
    if (![home, away].every((n) => Number.isInteger(n) && n >= 0 && n < 400)) throw new AppError("invalid_score");
    const clock =
      String(form.get("clock") ?? "")
        .trim()
        .slice(0, 20) || null;
    await updateLive(String(form.get("eventId")), home, away, clock);
  });
}

export async function setAllMarketsAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(() =>
    setAllMarkets(String(form.get("eventId")), form.get("status") === "OPEN" ? "OPEN" : "SUSPENDED"),
  );
}

export async function reviewKycAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const decision = form.get("decision") === "approve" ? "approve" : "reject";
    const note =
      String(form.get("note") ?? "")
        .trim()
        .slice(0, 500) || null;
    await reviewKyc(String(form.get("submissionId")), decision, note);
  });
}

export async function settleEventAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const home = Number(form.get("homeScore"));
    const away = Number(form.get("awayScore"));
    if (![home, away].every((n) => Number.isInteger(n) && n >= 0 && n < 400)) throw new AppError("invalid_score");
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
    const drawId = String(form.get("drawId"));
    if (form.has("pick3")) {
      await settleWithPicks(drawId, String(form.get("pick3") ?? ""), String(form.get("pick4") ?? ""));
      return;
    }
    await settleDraw(drawId, {
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
