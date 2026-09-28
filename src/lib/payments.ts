import { prisma } from "./db";
import { CURRENCY_LIMITS, Decimal } from "./money";
import { activeProvider, type WebhookEvent } from "./payment-providers";
import { AppError, type Currency, type PaymentMethod } from "./types";
import { credit, debit, getOrCreateWallet } from "./wallet";

/** "mock" enables the simulate-payment button for players; never set it in production. */
export const paymentsMode = () => (activeProvider().name === "mock" ? "mock" : "live");

export async function createDeposit(userId: string, currency: Currency, method: PaymentMethod, amount: Decimal) {
  const limits = CURRENCY_LIMITS[currency];
  if (!limits.depositMethods.includes(method)) throw new AppError("method_unavailable");
  if (amount.lt(limits.minDeposit) || amount.gt(limits.maxDeposit)) {
    throw new AppError("amount_out_of_range", { min: limits.minDeposit, max: limits.maxDeposit });
  }
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

  const payment = await prisma.payment.create({
    data: { userId, walletId: wallet.id, kind: "DEPOSIT", method, amount },
  });
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { kycSubmissions: { where: { status: "VERIFIED" }, take: 1 } },
  });
  const { providerRef, instructions } = await activeProvider().createDeposit({
    paymentId: payment.id,
    method,
    amount,
    currency,
    payer: { name: user.name, email: user.email, documentNumber: user.kycSubmissions[0]?.documentNumber },
  });
  return prisma.payment.update({
    where: { id: payment.id },
    data: { providerRef, instructions: JSON.stringify(instructions) },
  });
}

/** Credit a pending deposit exactly once. Called by the provider webhook / admin / mock. */
export async function confirmDeposit(paymentId: string) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.kind !== "DEPOSIT") throw new AppError("forbidden");
    const res = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: "COMPLETED" },
    });
    if (res.count === 0) throw new AppError("payment_not_pending");
    await credit(tx, payment.walletId, payment.amount, "DEPOSIT", `payment:${paymentId}`);
  });
}

export async function rejectDeposit(paymentId: string) {
  const res = await prisma.payment.updateMany({
    where: { id: paymentId, kind: "DEPOSIT", status: "PENDING" },
    data: { status: "REJECTED" },
  });
  if (res.count === 0) throw new AppError("payment_not_pending");
}

/** Apply a verified provider webhook. Idempotent: replays are ignored. */
export async function applyWebhook(event: WebhookEvent) {
  const payment = await prisma.payment.findUnique({ where: { providerRef: event.providerRef } });
  if (!payment || payment.kind !== "DEPOSIT" || payment.status !== "PENDING") return "ignored";
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

/** Funds are held (debited) as soon as a withdrawal is requested. */
export async function requestWithdrawal(
  userId: string,
  currency: Currency,
  method: PaymentMethod,
  amount: Decimal,
  destination: string,
) {
  const limits = CURRENCY_LIMITS[currency];
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.kycStatus !== "VERIFIED") throw new AppError("kyc_required");
  if (!limits.withdrawalMethods.includes(method)) throw new AppError("method_unavailable");
  if (amount.lt(limits.minWithdrawal)) throw new AppError("amount_below_min", { min: limits.minWithdrawal });
  const dest = destination.trim();
  if (method === "SPEI" && !/^\d{18}$/.test(dest)) throw new AppError("invalid_clabe");
  if (method === "PIX" && (dest.length < 5 || dest.length > 77)) throw new AppError("invalid_pix_key");

  return prisma.$transaction(async (tx) => {
    const wallet = await getOrCreateWallet(userId, currency, tx);
    const payment = await tx.payment.create({
      data: {
        userId,
        walletId: wallet.id,
        kind: "WITHDRAWAL",
        method,
        amount,
        instructions: JSON.stringify(method === "PIX" ? { pixKey: dest } : { clabe: dest }),
      },
    });
    await debit(tx, wallet.id, amount, "WITHDRAWAL", `payment:${payment.id}`);
    return payment;
  });
}

export async function approveWithdrawal(paymentId: string) {
  const res = await prisma.payment.updateMany({
    where: { id: paymentId, kind: "WITHDRAWAL", status: "PENDING" },
    data: { status: "COMPLETED" },
  });
  if (res.count === 0) throw new AppError("payment_not_pending");
}

export async function rejectWithdrawal(paymentId: string) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const res = await tx.payment.updateMany({
      where: { id: paymentId, kind: "WITHDRAWAL", status: "PENDING" },
      data: { status: "REJECTED" },
    });
    if (res.count === 0) throw new AppError("payment_not_pending");
    await credit(tx, payment.walletId, payment.amount, "REFUND", `payment:${paymentId}`);
  });
}
