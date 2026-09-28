/**
 * WhatsApp agent. Sends customers their payment details and updates through
 * Evolution API, and understands their replies: receipts (image/PDF), service
 * codes and PIX keys for payouts. Every message is logged in WhatsAppMessage.
 */
import QRCode from "qrcode";
import { prisma } from "./db";
import { evolution, evolutionConfig } from "./evolution";
import { translator } from "./i18n-server";
import { pickLabel } from "./labels";
import { LOCALE_TAGS } from "./locale-tags";
import { formatMoney } from "./money";
import { attachReceipt, RECEIPT_MAX_BYTES, RECEIPT_TYPES, setPayoutKey } from "./orders";
import { detectPixKey, findOrderCode, type IncomingMessage } from "./orders-rules";
import { formatPixKey, pixBrCode } from "./pix";
import { getPaymentSettings } from "./settings";
import { AppError } from "./types";

const TZ = "America/Sao_Paulo";

function siteUrl() {
  return (
    process.env.SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  ).replace(/\/+$/, "");
}

function when(date: Date, locale: string) {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale] ?? locale, {
    timeZone: TZ,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

async function log(
  phone: string,
  direction: "IN" | "OUT",
  status: string,
  body: string | null,
  orderId?: string | null,
  type = "TEXT",
  error?: string,
) {
  await prisma.whatsAppMessage.create({
    data: {
      phone,
      direction,
      status,
      body: body?.slice(0, 4000) ?? null,
      orderId: orderId ?? null,
      type,
      error: error?.slice(0, 500),
    },
  });
}

/** Send a text; logs SENT, FAILED, or SKIPPED when the agent isn't connected. Never throws. */
export async function sendText(phone: string, text: string, orderId?: string | null) {
  if (!phone) return; // cash sale without a WhatsApp number
  const cfg = evolutionConfig();
  if (!cfg) return log(phone, "OUT", "SKIPPED", text, orderId);
  try {
    await evolution.sendText(cfg, phone, text);
    await log(phone, "OUT", "SENT", text, orderId);
  } catch (err) {
    console.error("[agent] sendText failed", err);
    await log(phone, "OUT", "FAILED", text, orderId, "TEXT", String(err));
  }
}

async function sendImage(phone: string, pngBase64: string, caption: string, orderId?: string | null) {
  if (!phone) return;
  const cfg = evolutionConfig();
  if (!cfg) return log(phone, "OUT", "SKIPPED", caption, orderId, "IMAGE");
  try {
    await evolution.sendImage(cfg, phone, pngBase64, caption);
    await log(phone, "OUT", "SENT", caption, orderId, "IMAGE");
  } catch (err) {
    console.error("[agent] sendImage failed", err);
    await log(phone, "OUT", "FAILED", caption, orderId, "IMAGE", String(err));
  }
}

async function loadOrder(orderId: string) {
  return prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    omit: { receipt: true },
    include: {
      bet: { include: { legs: { include: { selection: { include: { market: { include: { event: true } } } } } } } },
      ticket: { include: { lines: true, draw: true } },
    },
  });
}
type FullOrder = Awaited<ReturnType<typeof loadOrder>>;

/** Human summary of the bet or ticket, in the customer's language. */
export async function orderSummary(order: FullOrder): Promise<string> {
  const locale = order.locale;
  if (order.bet) {
    const ts = await translator(locale, "sports");
    const tr = (k: string, v?: Record<string, string | number>) => ts(k, v);
    return order.bet.legs
      .map((l) => {
        const m = l.selection.market;
        const e = m.event;
        const pick = pickLabel(
          tr,
          e,
          { type: m.type, line: m.line === null ? null : Number(m.line) },
          l.selection.code,
        );
        return `• ${pick} — ${e.homeTeam} x ${e.awayTeam} @ ${Number(l.odds).toFixed(2)}`;
      })
      .join("\n");
  }
  if (order.ticket) {
    const tl = await translator(locale, "lottery");
    const d = order.ticket.draw;
    const head = d.lottery ? `${tl(`lotteries.${d.lottery}`)} · ${tl(`sessions.${d.session}`)}` : d.name;
    const lines = order.ticket.lines.map(
      (l) => `• ${tl(`types.${l.type}`)} ${l.numbers} — ${formatMoney(l.stake, locale)}`,
    );
    return [`🎟️ ${head} (${when(d.drawAt ?? d.closesAt, locale)})`, ...lines].join("\n");
  }
  return "";
}

/** Right after a service is created: summary, PIX details, QR image and the copy-paste code. */
export async function sendPaymentInfo(orderId: string) {
  const order = await loadOrder(orderId);
  const t = await translator(order.locale, "bot");
  const s = await getPaymentSettings();
  const summary = await orderSummary(order);
  const amount = formatMoney(order.amount, order.locale);
  if (!s["pix.key"] || !s["pix.name"]) {
    await sendText(
      order.phone,
      t("createdNoPix", { name: order.customerName, code: order.code, summary, amount }),
      order.id,
    );
    return;
  }
  await sendText(
    order.phone,
    t("created", {
      name: order.customerName,
      code: order.code,
      summary,
      amount,
      potential: formatMoney(order.potentialWin, order.locale),
      keyType: s["pix.keyType"] ?? "",
      key: formatPixKey(s["pix.keyType"] ?? "", s["pix.key"]),
      beneficiary: s["pix.name"],
      deadline: when(order.payBy, order.locale),
      link: `${siteUrl()}/${order.locale}/s/${order.code}`,
    }),
    order.id,
  );
  const pixCode = pixBrCode({
    key: s["pix.key"],
    name: s["pix.name"],
    city: s["pix.city"] ?? "BRASIL",
    amount: order.amount.toFixed(2),
    txid: order.code,
  });
  const png = await QRCode.toBuffer(pixCode, { type: "png", width: 480, margin: 2 });
  await sendImage(order.phone, png.toString("base64"), t("qrCaption", { code: order.code, amount }), order.id);
  await sendText(order.phone, pixCode, order.id);
}

export async function notifyConfirmed(orderId: string) {
  const order = await loadOrder(orderId);
  const t = await translator(order.locale, "bot");
  await sendText(
    order.phone,
    t(order.channel === "AGENT" ? "soldCash" : "confirmed", {
      code: order.code,
      amount: formatMoney(order.amount, order.locale),
      potential: formatMoney(order.potentialWin, order.locale),
    }),
    order.id,
  );
}

export async function notifyRejected(orderId: string) {
  const order = await loadOrder(orderId);
  const t = await translator(order.locale, "bot");
  await sendText(order.phone, t("rejected", { code: order.code, reason: order.adminNote ?? "—" }), order.id);
}

export async function notifyExpired(orderId: string) {
  const order = await loadOrder(orderId);
  const t = await translator(order.locale, "bot");
  await sendText(order.phone, t("expired", { code: order.code }), order.id);
}

/** After settlement: winners and refunds are asked for their PIX key. */
export async function notifyResults(orderIds: string[]) {
  for (const id of orderIds) {
    const order = await loadOrder(id);
    const t = await translator(order.locale, "bot");
    const payout = order.payout ? formatMoney(order.payout, order.locale) : "";
    // Cash sales are paid at an agent point with the code; online ones by PIX.
    const cash = order.channel === "AGENT" ? "Cash" : "";
    if (order.status === "WON") await sendText(order.phone, t(`won${cash}`, { code: order.code, payout }), order.id);
    else if (order.status === "VOID")
      await sendText(order.phone, t(`void${cash}`, { code: order.code, payout }), order.id);
    else if (order.status === "LOST") await sendText(order.phone, t("lost", { code: order.code }), order.id);
  }
}

export async function notifyPaid(orderId: string) {
  const order = await loadOrder(orderId);
  const t = await translator(order.locale, "bot");
  if (order.payoutKeyType === "CASH") {
    const payout = order.payout ? formatMoney(order.payout, order.locale) : "";
    return sendText(order.phone, t("paidCash", { code: order.code, payout }), order.id);
  }
  await sendText(
    order.phone,
    t("paid", {
      code: order.code,
      payout: order.payout ? formatMoney(order.payout, order.locale) : "",
      key: formatPixKey(order.payoutKeyType ?? "", order.payoutKey ?? ""),
    }),
    order.id,
  );
}

/** Handle a message a customer sent to the agent's WhatsApp number. */
export async function handleIncoming(msg: IncomingMessage) {
  const code = findOrderCode(msg.text);
  const byCode = code ? await prisma.order.findUnique({ where: { code }, omit: { receipt: true } }) : null;
  // Codes only count for the phone that created the service.
  const coded = byCode && byCode.phone === msg.phone ? byCode : null;
  const recent = await prisma.order.findMany({
    where: { phone: msg.phone },
    orderBy: { createdAt: "desc" },
    take: 10,
    omit: { receipt: true },
  });
  const locale = coded?.locale ?? recent[0]?.locale ?? "pt";
  const t = await translator(locale, "bot");
  await log(
    msg.phone,
    "IN",
    "RECEIVED",
    msg.media ? `[${msg.media.type}] ${msg.text}`.trim() : msg.text,
    coded?.id ?? recent[0]?.id,
    msg.media?.type ?? "TEXT",
  );

  // 1) A receipt (image or PDF) for an unpaid service.
  if (msg.media) {
    const target = coded ?? recent.find((o) => o.status === "AWAITING_PAYMENT" || o.status === "RECEIPT_RECEIVED");
    if (!target) return sendText(msg.phone, t("noOpenOrder", { link: siteUrl() }));
    let base64 = msg.media.base64;
    let mime = msg.media.mimetype.split(";")[0].trim();
    if (!base64) {
      const cfg = evolutionConfig();
      if (!cfg) return;
      try {
        const media = await evolution.mediaBase64(cfg, msg.id);
        base64 = media.base64;
        mime = media.mimetype?.split(";")[0] ?? mime;
      } catch (err) {
        console.error("[agent] media download failed", err);
        return sendText(msg.phone, t("receiptError"), target.id);
      }
    }
    if (!RECEIPT_TYPES.includes(mime)) return sendText(msg.phone, t("receiptType"), target.id);
    const data = new Uint8Array(Buffer.from(base64!, "base64"));
    if (data.byteLength > RECEIPT_MAX_BYTES) return sendText(msg.phone, t("receiptType"), target.id);
    try {
      const { late } = await attachReceipt(target.id, mime, data);
      return sendText(
        msg.phone,
        late ? t("receiptLate", { code: target.code }) : t("receiptOk", { code: target.code }),
        target.id,
      );
    } catch (err) {
      if (err instanceof AppError) return sendText(msg.phone, t("receiptClosed", { code: target.code }), target.id);
      throw err;
    }
  }

  // 2) A PIX key for a winning / refunded service that still needs one.
  // Only online services: cash sales are paid out at an agent point.
  const needsKey = (o: { status: string; channel: string }) =>
    (o.status === "WON" || o.status === "VOID") && o.channel === "ONLINE";
  const payable = (coded && needsKey(coded) ? coded : null) ?? recent.find((o) => needsKey(o) && !o.payoutKey);
  if (payable && !payable.payoutKey) {
    const pix = detectPixKey(msg.text);
    if (pix) {
      const key = await setPayoutKey(payable.id, pix.type, pix.key);
      return sendText(
        msg.phone,
        t("pixSaved", { code: payable.code, type: pix.type, key: formatPixKey(pix.type, key) }),
        payable.id,
      );
    }
    return sendText(msg.phone, t("pixInvalid", { code: payable.code }), payable.id);
  }

  // 3) Status of a service by its code.
  if (coded) {
    const ts = await translator(locale, "orders");
    return sendText(msg.phone, t("status", { code: coded.code, status: ts(`status.${coded.status}`) }), coded.id);
  }

  // 4) Anything else: short help with the open services of this number.
  const open = recent.filter((o) => !["PAID", "LOST", "REJECTED", "EXPIRED"].includes(o.status)).map((o) => o.code);
  return sendText(msg.phone, t("help", { link: siteUrl(), codes: open.length ? open.join(", ") : "—" }));
}
