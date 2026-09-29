import { Prisma } from "@prisma/client";
import { routing } from "@/i18n/routing";
import { prisma } from "./db";
import { createTicketForOrder, quoteLotteryTicket, settleLotteryOrder, type TicketLineInput } from "./lottery";
import { Decimal, parseAmount } from "./money";
import { CANCEL_WINDOW_MINUTES, cancellable, newOrderCode, normalizeBrPhone } from "./orders-rules";
import { normalizePixKey } from "./pix";
import { createBetForOrder, LONG_TX, quoteSportsBet, settleSportsOrder, type SlipLeg } from "./sports";
import { AppError } from "./types";

/** A phone number can hold this many unpaid services at once. */
const MAX_OPEN_PER_PHONE = 5;
export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

type Customer = { customerName: string; phone: string; locale: string };
export type CreateOrderInput =
  | (Customer & { kind: "SPORTS"; stake: string; legs: SlipLeg[] })
  | (Customer & {
      kind: "LOTTERY";
      drawId: string;
      lines: { type: TicketLineInput["type"]; numbers: string; stake: string }[];
    });

function amount(value: string) {
  const parsed = parseAmount(value);
  if (!parsed) throw new AppError("invalid_amount");
  return parsed;
}

/**
 * Create a service. Online (no seller): it waits for the customer's PIX
 * payment and the WhatsApp agent sends the payment details. Sold by an agent
 * (seller): the cash is already in hand, so it is confirmed at once and the
 * customer's WhatsApp number is optional.
 */
export async function createOrder(input: CreateOrderInput, seller?: { id: string }) {
  const customerName = input.customerName.trim().replace(/\s+/g, " ");
  if (customerName.length < 2 || customerName.length > 80) throw new AppError("invalid_name");
  const phone = seller && !input.phone.trim() ? "" : normalizeBrPhone(input.phone);
  if (phone === null) throw new AppError("invalid_phone");
  const locale = (routing.locales as readonly string[]).includes(input.locale) ? input.locale : routing.defaultLocale;

  if (!seller) {
    const open = await prisma.order.count({ where: { phone, status: "AWAITING_PAYMENT" } });
    if (open >= MAX_OPEN_PER_PHONE) throw new AppError("too_many_open", { max: MAX_OPEN_PER_PHONE });
  }

  let total: Decimal, potentialWin: Decimal, payBy: Date;
  let sportsStake: Decimal | null = null;
  let lotteryLines: TicketLineInput[] = [];
  if (input.kind === "SPORTS") {
    sportsStake = amount(input.stake);
    const q = await quoteSportsBet(sportsStake, input.legs);
    [total, potentialWin, payBy] = [sportsStake, q.potentialWin, q.payBy];
  } else {
    lotteryLines = input.lines.map((l) => ({ type: l.type, numbers: l.numbers, stake: amount(l.stake) }));
    const q = await quoteLotteryTicket(input.drawId, lotteryLines);
    [total, potentialWin, payBy] = [q.totalStake, q.maxWin, q.payBy];
  }

  for (let attempt = 0; ; attempt++) {
    try {
      const order = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            code: newOrderCode(),
            kind: input.kind,
            customerName,
            phone,
            locale,
            amount: total,
            potentialWin,
            payBy,
            ...(seller && {
              channel: "AGENT",
              soldById: seller.id,
              status: "CONFIRMED",
              receiptAt: new Date(),
              confirmedAt: new Date(),
            }),
          },
        });
        if (input.kind === "SPORTS") await createBetForOrder(tx, created.id, sportsStake!, input.legs);
        else await createTicketForOrder(tx, created.id, input.drawId, lotteryLines);
        return created;
      }, LONG_TX);
      // WhatsApp (logged, never blocks the order): payment details online, a confirmation for cash sales.
      const agent = await import("./agent");
      if (seller) await agent.notifyConfirmed(order.id);
      else await agent.sendPaymentInfo(order.id);
      return order;
    } catch (err) {
      // Code collision (unique) — extremely rare; try a new code.
      if (attempt < 3 && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
}

export function getOrderByCode(code: string) {
  return prisma.order.findUnique({
    where: { code: code.trim().toUpperCase() },
    omit: { receipt: true },
    include: {
      bet: { include: { legs: { include: { selection: { include: { market: { include: { event: true } } } } } } } },
      ticket: { include: { lines: true, draw: true } },
    },
  });
}

/** Store the customer's proof of payment (from WhatsApp). Returns whether it arrived after the deadline. */
export async function attachReceipt(orderId: string, mime: string, data: Uint8Array<ArrayBuffer>) {
  if (!RECEIPT_TYPES.includes(mime)) throw new AppError("receipt_type");
  if (data.byteLength > RECEIPT_MAX_BYTES) throw new AppError("receipt_too_large");
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "AWAITING_PAYMENT" && order.status !== "RECEIPT_RECEIVED") throw new AppError("order_not_open");
  const now = new Date();
  await prisma.order.update({
    where: { id: orderId },
    data: {
      receipt: data,
      receiptMime: mime,
      // Keep the first on-time receipt time if the customer sends another one.
      receiptAt: order.receiptAt && order.receiptAt <= order.payBy ? order.receiptAt : now,
      status: "RECEIPT_RECEIVED",
    },
  });
  return { late: now > order.payBy && !(order.receiptAt && order.receiptAt <= order.payBy) };
}

/** Payment is valid if the receipt arrived before the deadline (or the admin confirms before it). */
export function paidInTime(order: { payBy: Date; receiptAt: Date | null }, now = new Date()) {
  return (order.receiptAt !== null && order.receiptAt <= order.payBy) || now <= order.payBy;
}

/** Admin confirms the payment: the bet/ticket becomes active (and is settled at once if already decided). */
export async function confirmOrder(orderId: string, adminNote: string | null) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "AWAITING_PAYMENT" && order.status !== "RECEIPT_RECEIVED") throw new AppError("order_not_open");
  if (!paidInTime(order)) throw new AppError("paid_too_late");
  const res = await prisma.order.updateMany({
    where: { id: orderId, status: order.status },
    data: { status: "CONFIRMED", confirmedAt: new Date(), adminNote },
  });
  if (res.count === 0) throw new AppError("order_not_open");
  const agent = await import("./agent");
  await agent.notifyConfirmed(orderId);
  const settled = order.kind === "SPORTS" ? await settleSportsOrder(orderId) : await settleLotteryOrder(orderId);
  if (settled) await agent.notifyResults([orderId]);
}

export async function rejectOrder(orderId: string, adminNote: string) {
  const res = await prisma.order.updateMany({
    where: { id: orderId, status: { in: ["AWAITING_PAYMENT", "RECEIPT_RECEIVED"] } },
    data: { status: "REJECTED", adminNote },
  });
  if (res.count === 0) throw new AppError("order_not_open");
  await (await import("./agent")).notifyRejected(orderId);
}

/** Unpaid services whose deadline passed become EXPIRED (called lazily from the admin). */
export async function expireOverdue() {
  const overdue = await prisma.order.findMany({
    where: { status: "AWAITING_PAYMENT", payBy: { lt: new Date() } },
    select: { id: true },
    take: 100,
  });
  if (!overdue.length) return;
  await prisma.order.updateMany({
    where: { id: { in: overdue.map((o) => o.id) }, status: "AWAITING_PAYMENT" },
    data: { status: "EXPIRED" },
  });
  const agent = await import("./agent");
  for (const o of overdue) await agent.notifyExpired(o.id);
}

/** Winner's (or refund) PIX key, from WhatsApp or typed by the admin. */
export async function setPayoutKey(orderId: string, type: string, rawKey: string) {
  const key = normalizePixKey(type, rawKey);
  if (!key) throw new AppError("invalid_pix_key");
  const res = await prisma.order.updateMany({
    where: { id: orderId, status: { in: ["WON", "VOID"] }, channel: "ONLINE" },
    data: { payoutKeyType: type, payoutKey: key },
  });
  if (res.count === 0) throw new AppError("order_not_payable");
  return key;
}

/** Admin paid the winnings/refund by PIX: the service is finalised. */
export async function markPaid(orderId: string, adminNote: string | null) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "WON" && order.status !== "VOID") throw new AppError("order_not_payable");
  if (!order.payoutKey) throw new AppError("payout_key_missing");
  const res = await prisma.order.updateMany({
    where: { id: orderId, status: order.status },
    data: { status: "PAID", paidAt: new Date(), adminNote: adminNote ?? order.adminNote },
  });
  if (res.count === 0) throw new AppError("order_not_payable");
  await (await import("./agent")).notifyPaid(orderId);
}

// ---------- Cash sales by agents ----------

/** The agent who sold it returns the cash: the sale no longer counts. */
export async function cancelSale(orderId: string, user: { id: string }) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!cancellable(order, user.id)) throw new AppError("sale_not_cancellable", { minutes: CANCEL_WINDOW_MINUTES });
  const res = await prisma.order.updateMany({
    where: { id: orderId, status: "CONFIRMED" },
    data: { status: "CANCELLED", adminNote: "Venda anulada pelo agente" },
  });
  if (res.count === 0) throw new AppError("sale_not_cancellable", { minutes: CANCEL_WINDOW_MINUTES });
}

/**
 * Finalise a cash sale by its code: the winnings (or refund) are handed over
 * in cash. Only services sold by an agent — online ones are paid by PIX.
 */
export async function payOutCash(orderId: string, user: { id: string }, note: string | null) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.channel !== "AGENT") throw new AppError("online_service_pix");
  if (order.status !== "WON" && order.status !== "VOID") throw new AppError("order_not_payable");
  const res = await prisma.order.updateMany({
    where: { id: orderId, status: order.status },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paidById: user.id,
      payoutKeyType: "CASH",
      payoutKey: null,
      adminNote: note ?? order.adminNote,
    },
  });
  if (res.count === 0) throw new AppError("order_not_payable");
  await (await import("./agent")).notifyPaid(orderId);
}
