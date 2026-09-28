import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import { CURRENCY_LIMITS, Decimal } from "./money";
import { AppError, type Currency, type PaymentMethod } from "./types";
import { credit, debit, getOrCreateWallet } from "./wallet";

/**
 * Payment provider boundary. The mock provider returns realistic-looking
 * instructions; replace it with a real PIX / SPEI / OXXO integration and
 * confirm deposits from that provider's webhook via `confirmDeposit`.
 */
interface PaymentProvider {
  createDeposit(p: { paymentId: string; method: PaymentMethod; amount: Decimal; currency: Currency }): Promise<{
    providerRef: string;
    instructions: Record<string, string>;
  }>;
}

const mockProvider: PaymentProvider = {
  async createDeposit({ paymentId, method, amount }): Promise<{ providerRef: string; instructions: Record<string, string> }> {
    const ref = randomBytes(6).toString("hex").toUpperCase();
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    switch (method) {
      case "PIX":
        return {
          providerRef: `pix_${ref}`,
          instructions: {
            pixCode: `00020126580014BR.GOV.BCB.PIX0136${paymentId}5204000053039865406${amount.toFixed(2)}5802BR5909PARYAJNET6009SAO PAULO62070503***6304${ref.slice(0, 4)}`,
            expiresAt,
          },
        };
      case "SPEI":
        return {
          providerRef: `spei_${ref}`,
          instructions: {
            clabe: `646180${String(parseInt(ref, 16)).padStart(12, "0").slice(0, 12)}`,
            reference: ref.slice(0, 7),
            beneficiary: "ParyajNet",
          },
        };
      case "OXXO":
        return {
          providerRef: `oxxo_${ref}`,
          instructions: { reference: String(parseInt(ref, 16)).padStart(14, "0").slice(0, 14), expiresAt },
        };
    }
  },
};

export const paymentsMode = () => (process.env.PAYMENTS_MODE === "live" ? "live" : "mock");

function provider(): PaymentProvider {
  if (paymentsMode() === "live") throw new AppError("payments_unavailable");
  return mockProvider;
}

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
  const { providerRef, instructions } = await provider().createDeposit({
    paymentId: payment.id,
    method,
    amount,
    currency,
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

/** Funds are held (debited) as soon as a withdrawal is requested. */
export async function requestWithdrawal(
  userId: string,
  currency: Currency,
  method: PaymentMethod,
  amount: Decimal,
  destination: string,
) {
  const limits = CURRENCY_LIMITS[currency];
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
