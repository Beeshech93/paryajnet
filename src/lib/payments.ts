import { randomInt } from "node:crypto";
import { prisma } from "./db";
import { CURRENCY_LIMITS, Decimal } from "./money";
import { availableDepositMethods, providerFor, type WebhookEvent } from "./payment-providers";
import { normalizePixKey } from "./pix";
import { AppError, type Currency, type PaymentMethod } from "./types";
import { credit, debit, getOrCreateWallet } from "./wallet";

/** A player can have this many deposits waiting for confirmation at once. */
const MAX_PENDING_DEPOSITS = 3;
const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const RECEIPT_MAX_BYTES = 3 * 1024 * 1024;

/** Short, unambiguous code the player quotes in the transfer (no 0/O/1/I). */
async function newReference(): Promise<string> {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = "PJ" + Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
    if (!(await prisma.payment.findFirst({ where: { reference: code }, select: { id: true } }))) return code;
  }
  throw new Error("Could not allocate a payment reference");
}

export async function createDeposit(userId: string, currency: Currency, method: PaymentMethod, amount: Decimal) {
  const limits = CURRENCY_LIMITS[currency];
  const methods = await availableDepositMethods(limits.depositMethods);
  if (!methods.includes(method)) throw new AppError("method_unavailable");
  if (amount.lt(limits.minDeposit) || amount.gt(limits.maxDeposit)) {
    throw new AppError("amount_out_of_range", { min: limits.minDeposit, max: limits.maxDeposit });
  }
  const pending = await prisma.payment.count({ where: { userId, kind: "DEPOSIT", status: "PENDING" } });
  if (pending >= MAX_PENDING_DEPOSITS) throw new AppError("too_many_pending", { max: MAX_PENDING_DEPOSITS });

  const wallet = await getOrCreateWallet(userId, currency);
  if (wallet.dailyDepositLimit) {
    const since = new Date(Date.now() - 24 * 60 * 60_000);
    const recent = await prisma.payment.aggregate({
      where: {
        walletId: wallet.id,
        kind: "DEPOSIT",
        status: { in: ["PENDING", "COMPLETED"] },
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    });
    const used = recent._sum.amount ?? new Decimal(0);
    if (used.add(amount).gt(wallet.dailyDepositLimit)) {
      throw new AppError("deposit_limit", { limit: wallet.dailyDepositLimit.toString() });
    }
  }

  const provider = providerFor(method);
  const reference = await newReference();
  const payment = await prisma.payment.create({
    data: { userId, walletId: wallet.id, kind: "DEPOSIT", method, amount, provider: provider.name, reference },
  });
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { kycSubmissions: { where: { status: "VERIFIED" }, take: 1 } },
  });
  let created;
  try {
    created = await provider.createDeposit({
      paymentId: payment.id,
      reference,
      method,
      amount,
      currency,
      payer: { name: user.name, email: user.email, documentNumber: user.kycSubmissions[0]?.documentNumber },
    });
  } catch (err) {
    console.error(`[payments] ${provider.name} createDeposit failed`, err);
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "REJECTED" } });
    throw new AppError("payments_unavailable");
  }
  return prisma.payment.update({
    where: { id: payment.id },
    data: { providerRef: created.providerRef, instructions: JSON.stringify(created.instructions) },
  });
}

/** The player tells us they paid: optional note (payer name / transaction id) and receipt. */
export async function attachReceipt(userId: string, paymentId: string, note: string, file: File | null) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.userId !== userId || payment.kind !== "DEPOSIT") throw new AppError("forbidden");
  if (payment.status !== "PENDING") throw new AppError("payment_not_pending");
  const cleanNote = note.trim().slice(0, 300);
  let receipt: { mime: string; data: Uint8Array<ArrayBuffer> } | null = null;
  if (file && file.size > 0) {
    if (!RECEIPT_TYPES.includes(file.type)) throw new AppError("receipt_type");
    if (file.size > RECEIPT_MAX_BYTES) throw new AppError("kyc_file_too_large", { max: 3 });
    receipt = { mime: file.type, data: new Uint8Array(await file.arrayBuffer()) };
  }
  if (!cleanNote && !receipt) throw new AppError("receipt_missing");
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      ...(cleanNote ? { payerNote: cleanNote } : {}),
      ...(receipt ? { receiptMime: receipt.mime, receipt: receipt.data } : {}),
    },
  });
}

/** Credit a pending deposit exactly once. Called by an admin or a provider webhook. */
export async function confirmDeposit(paymentId: string, adminNote?: string | null) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.kind !== "DEPOSIT") throw new AppError("forbidden");
    const res = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: "COMPLETED", reviewedAt: new Date(), adminNote: adminNote || null },
    });
    if (res.count === 0) throw new AppError("payment_not_pending");
    await credit(tx, payment.walletId, payment.amount, "DEPOSIT", `payment:${paymentId}`);
  });
}

export async function rejectDeposit(paymentId: string, adminNote?: string | null) {
  const res = await prisma.payment.updateMany({
    where: { id: paymentId, kind: "DEPOSIT", status: "PENDING" },
    data: { status: "REJECTED", reviewedAt: new Date(), adminNote: adminNote || null },
  });
  if (res.count === 0) throw new AppError("payment_not_pending");
}

/** Apply a verified provider webhook. Idempotent: replays are ignored. */
export async function applyWebhook(event: WebhookEvent, providerName?: string) {
  const payment = await prisma.payment.findUnique({ where: { providerRef: event.providerRef } });
  if (!payment || payment.kind !== "DEPOSIT" || payment.status !== "PENDING") return "ignored";
  if (providerName && payment.provider !== providerName) return "ignored";
  if (event.status === "FAILED") {
    await rejectDeposit(payment.id);
    return "rejected";
  }
  if (event.amount && !new Decimal(event.amount).equals(payment.amount)) {
    // Paid a different amount: leave it for manual review instead of crediting.
    return "amount_mismatch";
  }
  await confirmDeposit(payment.id);
  return "confirmed";
}

export const withdrawalsRequireKyc = () => process.env.WITHDRAWALS_REQUIRE_KYC !== "false";

/**
 * Funds are held (debited) as soon as a withdrawal is requested; an admin
 * pays it by hand to the player's PIX key / CLABE and marks it as paid.
 */
export async function requestWithdrawal(
  userId: string,
  currency: Currency,
  method: PaymentMethod,
  amount: Decimal,
  destination: string,
  pixKeyType?: string,
) {
  const limits = CURRENCY_LIMITS[currency];
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (withdrawalsRequireKyc() && user.kycStatus !== "VERIFIED") throw new AppError("kyc_required");
  if (!limits.withdrawalMethods.includes(method)) throw new AppError("method_unavailable");
  if (amount.lt(limits.minWithdrawal)) throw new AppError("amount_below_min", { min: limits.minWithdrawal });

  let details: Record<string, string>;
  if (method === "PIX") {
    const key = normalizePixKey(pixKeyType ?? "", destination);
    if (!key) throw new AppError("invalid_pix_key");
    details = { pixKeyType: pixKeyType!, pixKey: key };
  } else {
    const clabe = destination.replace(/\s/g, "");
    if (!/^\d{18}$/.test(clabe)) throw new AppError("invalid_clabe");
    details = { clabe };
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await getOrCreateWallet(userId, currency, tx);
    const payment = await tx.payment.create({
      data: {
        userId,
        walletId: wallet.id,
        kind: "WITHDRAWAL",
        method,
        provider: "manual",
        amount,
        reference: await newReference(),
        instructions: JSON.stringify(details),
      },
    });
    await debit(tx, wallet.id, amount, "WITHDRAWAL", `payment:${payment.id}`);
    return payment;
  });
}

/** Admin paid the withdrawal by hand; optional note (e.g. PIX end-to-end id). */
export async function approveWithdrawal(paymentId: string, adminNote?: string | null) {
  const res = await prisma.payment.updateMany({
    where: { id: paymentId, kind: "WITHDRAWAL", status: "PENDING" },
    data: { status: "COMPLETED", reviewedAt: new Date(), adminNote: adminNote || null },
  });
  if (res.count === 0) throw new AppError("payment_not_pending");
}

/** Rejecting a withdrawal returns the held funds to the player. */
export async function rejectWithdrawal(paymentId: string, adminNote?: string | null) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const res = await tx.payment.updateMany({
      where: { id: paymentId, kind: "WITHDRAWAL", status: "PENDING" },
      data: { status: "REJECTED", reviewedAt: new Date(), adminNote: adminNote || null },
    });
    if (res.count === 0) throw new AppError("payment_not_pending");
    await credit(tx, payment.walletId, payment.amount, "REFUND", `payment:${paymentId}`);
  });
}
