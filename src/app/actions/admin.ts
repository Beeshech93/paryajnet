"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { adminForAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cancelDraw, settleDraw, settleWithPicks } from "@/lib/lottery";
import { Decimal } from "@/lib/money";
import { BANNER_LOCALES, BANNER_THEMES, normalizeLink, PLACEMENTS, readImage } from "@/lib/banners";
import { normalizePixKey } from "@/lib/pix";
import { savePaymentSettings, type PaymentSettings } from "@/lib/settings";
import { confirmOrder, markPaid, rejectOrder, setPayoutKey } from "@/lib/orders";
import { sendPaymentInfo, sendText } from "@/lib/agent";
import { evolution, evolutionConfig } from "@/lib/evolution";
import { normalizeBrPhone } from "@/lib/orders-rules";
import { saveSportsDataConfig, syncOdds, syncScores } from "@/lib/sports-sync";
import { basketballMarkets, footballMarkets } from "@/lib/pricing";
import {
  cancelEvent,
  createEvent,
  LONG_TX,
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
    await prisma.$transaction((tx) => upsertMarkets(tx, eventId, [{ type, line, selections }]), LONG_TX);
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

export async function savePaymentSettingsAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const get = (k: string) => String(form.get(k) ?? "").trim();
    const keyType = get("pix.keyType");
    const rawKey = get("pix.key");
    const values: PaymentSettings = { "pix.key": "", "pix.keyType": "" };
    if (rawKey) {
      const key = normalizePixKey(keyType, rawKey);
      if (!key) throw new AppError("invalid_pix_key");
      values["pix.key"] = key;
      values["pix.keyType"] = keyType;
    }
    values["pix.name"] = get("pix.name").slice(0, 25);
    values["pix.city"] = get("pix.city").slice(0, 15);
    values["pix.bank"] = get("pix.bank").slice(0, 60);
    if (values["pix.key"] && !values["pix.name"]) throw new AppError("pix_name_required");
    await savePaymentSettings(values);
  });
}

const bannerSchema = z.object({
  title: z.string().trim().min(1).max(100),
  kind: z.enum(["IMAGE", "TEXT"]),
  placement: z.enum(PLACEMENTS),
  locale: z.enum(BANNER_LOCALES),
  theme: z.enum(BANNER_THEMES).default("blue"),
  headline: z.string().trim().max(80).optional(),
  body: z.string().trim().max(160).optional(),
  cta: z.string().trim().max(30).optional(),
  linkUrl: z.string().optional(),
  sort: z.coerce.number().int().min(0).max(999).default(0),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export async function createBannerAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const raw = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
    const parsed = bannerSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("invalid_form");
    const d = parsed.data;
    if (d.kind === "TEXT" && !d.headline) throw new AppError("banner_headline_missing");
    const date = (v?: string) => (v ? new Date(v) : null);
    const [startsAt, endsAt] = [date(d.startsAt), date(d.endsAt)];
    if (startsAt && endsAt && endsAt <= startsAt) throw new AppError("invalid_dates");

    const image = d.kind === "IMAGE" ? await readImage(form.get("image") as File | null, true) : null;
    const mobile = d.kind === "IMAGE" ? await readImage(form.get("mobileImage") as File | null, false) : null;

    await prisma.banner.create({
      data: {
        title: d.title,
        kind: d.kind,
        placement: d.placement,
        locale: d.locale,
        theme: d.theme,
        headline: d.kind === "TEXT" ? d.headline : null,
        body: d.kind === "TEXT" ? d.body || null : null,
        cta: d.kind === "TEXT" ? d.cta || null : null,
        linkUrl: normalizeLink(d.linkUrl ?? ""),
        sort: d.sort,
        startsAt,
        endsAt,
        imageMime: image?.mime,
        image: image?.data,
        mobileMime: mobile?.mime,
        mobileImage: mobile?.data,
      },
    });
  });
}

export async function toggleBannerAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const banner = await prisma.banner.findUniqueOrThrow({ where: { id: String(form.get("bannerId")) } });
    await prisma.banner.update({ where: { id: banner.id }, data: { active: !banner.active } });
  });
}

export async function deleteBannerAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    await prisma.banner.delete({ where: { id: String(form.get("bannerId")) } });
  });
}

// ---------- Services (orders) ----------

const note = (form: FormData) =>
  String(form.get("note") ?? "")
    .trim()
    .slice(0, 300) || null;

export async function confirmOrderAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(() => confirmOrder(String(form.get("orderId")), note(form)));
}

export async function rejectOrderAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const reason = note(form);
    if (!reason) throw new AppError("note_required");
    await rejectOrder(String(form.get("orderId")), reason);
  });
}

export async function setPayoutKeyAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(() =>
    setPayoutKey(String(form.get("orderId")), String(form.get("keyType") ?? ""), String(form.get("key") ?? "")),
  );
}

/** Finalise: the winnings/refund were sent by PIX. */
export async function markPaidAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(() => markPaid(String(form.get("orderId")), note(form)));
}

export async function resendPaymentInfoAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(() => sendPaymentInfo(String(form.get("orderId"))));
}

// ---------- WhatsApp agent (Evolution API) ----------

function evo() {
  const cfg = evolutionConfig();
  if (!cfg) throw new AppError("whatsapp_not_configured");
  return cfg;
}

export async function whatsappConnectAction(_prev: ActionResult | null, _form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const cfg = evo();
    if ((await evolution.state(cfg)) === "missing") await evolution.createInstance(cfg);
  });
}

export async function whatsappWebhookAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const cfg = evo();
    const token = process.env.EVOLUTION_WEBHOOK_TOKEN;
    if (!token) throw new AppError("whatsapp_token_missing");
    const base = String(form.get("baseUrl") ?? "").replace(/\/+$/, "");
    if (!/^https:\/\//.test(base)) throw new AppError("invalid_link");
    await evolution.setWebhook(cfg, `${base}/api/whatsapp/webhook?token=${encodeURIComponent(token)}`);
  });
}

export async function whatsappTestAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    evo();
    const phone = normalizeBrPhone(String(form.get("phone") ?? ""));
    if (!phone) throw new AppError("invalid_phone");
    await sendText(
      phone,
      String(form.get("text") ?? "")
        .trim()
        .slice(0, 1000) || "ParyajNet ✅",
    );
  });
}

export async function whatsappLogoutAction(_prev: ActionResult | null, _form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    await evolution.logout(evo());
  });
}

// ---------- Real sports data (The Odds API) ----------

export async function saveSportsDataAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const sports = form
      .getAll("sports")
      .map(String)
      .filter((s) => /^[a-z0-9_]+$/.test(s));
    const num = (k: string, min: number, max: number) => {
      const n = Number(String(form.get(k) ?? "").replace(",", "."));
      if (!Number.isFinite(n) || n < min || n > max) throw new AppError("invalid_form");
      return n;
    };
    await saveSportsDataConfig({
      sports,
      marginPct: num("marginPct", 0, 20),
      oddsHours: num("oddsHours", 0.25, 168),
      scoresMinutes: num("scoresMinutes", 2, 1440),
    });
  });
}

export async function syncOddsNowAction(_prev: ActionResult | null, _form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const r = await syncOdds({ force: true });
    if ("skipped" in r && r.skipped === "no_key") throw new AppError("odds_api_key_missing");
  });
}

export async function syncScoresNowAction(_prev: ActionResult | null, _form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const r = await syncScores({ force: true });
    if ("skipped" in r && r.skipped === "no_key") throw new AppError("odds_api_key_missing");
  });
}

/** Remove the demo games created by the seed (only those without services). */
export async function removeDemoEventsAction(_prev: ActionResult | null, _form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    await prisma.event.deleteMany({
      where: { externalId: null, markets: { none: { selections: { some: { legs: { some: {} } } } } } },
    });
  });
}

// ---------- Back-office users (admins and sales agents) ----------

const STAFF_ROLES = ["AGENT", "ADMIN"] as const;

const userSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8).max(100),
  role: z.enum(STAFF_ROLES).default("AGENT"),
});

export async function createAgentAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const parsed = userSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      if (parsed.error.issues.some((i) => i.path[0] === "password")) throw new AppError("password_too_short");
      throw new AppError("invalid_form");
    }
    const { name, email, password, role } = parsed.data;
    if (await prisma.user.findUnique({ where: { email } })) throw new AppError("email_taken");
    await prisma.user.create({ data: { name, email, role, passwordHash: await bcrypt.hash(password, 10) } });
  });
}

export async function toggleAgentAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const me = await adminForAction();
    const id = String(form.get("id"));
    // An admin can't lock themselves out.
    if (id === me.id) throw new AppError("cannot_disable_self");
    const user = await prisma.user.findFirst({ where: { id, role: { in: [...STAFF_ROLES] } } });
    if (!user) throw new AppError("invalid_form");
    await prisma.user.update({ where: { id: user.id }, data: { active: !user.active } });
  });
}

export async function resetAgentPasswordAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return asAdmin(async () => {
    const password = String(form.get("password") ?? "");
    if (password.length < 8 || password.length > 100) throw new AppError("password_too_short");
    const res = await prisma.user.updateMany({
      where: { id: String(form.get("id")), role: { in: [...STAFF_ROLES] } },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    if (res.count === 0) throw new AppError("invalid_form");
  });
}
