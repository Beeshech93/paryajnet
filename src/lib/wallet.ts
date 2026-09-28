import { cookies } from "next/headers";
import { prisma, type Tx } from "./db";
import { DEFAULT_CURRENCY_BY_LOCALE, Decimal } from "./money";
import { AppError, isCurrency, type Currency, type TxType } from "./types";

export const CURRENCY_COOKIE = "pj_currency";

/** Currency the player is currently betting in (cookie > profile > locale default). */
export async function getActiveCurrency(user: { preferredCurrency: string } | null, locale: string): Promise<Currency> {
  const fromCookie = (await cookies()).get(CURRENCY_COOKIE)?.value;
  if (isCurrency(fromCookie)) return fromCookie;
  if (user && isCurrency(user.preferredCurrency)) return user.preferredCurrency;
  return DEFAULT_CURRENCY_BY_LOCALE[locale] ?? "BRL";
}

export async function getOrCreateWallet(userId: string, currency: Currency, tx: Tx = prisma) {
  return tx.wallet.upsert({
    where: { userId_currency: { userId, currency } },
    create: { userId, currency },
    update: {},
  });
}

/**
 * Atomically take money from a wallet. The conditional update guarantees the
 * balance never goes negative even under concurrent requests.
 */
export async function debit(tx: Tx, walletId: string, amount: Decimal, type: TxType, reference?: string) {
  const res = await tx.wallet.updateMany({
    where: { id: walletId, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  });
  if (res.count === 0) throw new AppError("insufficient_funds");
  const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: walletId } });
  await tx.transaction.create({
    data: { walletId, type, amount: amount.neg(), balanceAfter: wallet.balance, reference },
  });
  return wallet;
}

export async function credit(tx: Tx, walletId: string, amount: Decimal, type: TxType, reference?: string) {
  if (amount.lte(0)) return null;
  const wallet = await tx.wallet.update({
    where: { id: walletId },
    data: { balance: { increment: amount } },
  });
  await tx.transaction.create({
    data: { walletId, type, amount, balanceAfter: wallet.balance, reference },
  });
  return wallet;
}
