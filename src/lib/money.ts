import { Prisma } from "@prisma/client";

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

/** Stake and payout limits (BRL). */
export const LIMITS = {
  minStake: 1,
  maxStake: 10_000,
  maxPayout: 100_000,
};

export { LOCALE_TAGS } from "./locale-tags";
import { LOCALE_TAGS } from "./locale-tags";

export function formatMoney(amount: Decimal | number | string, locale: string, currency = "BRL"): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale] ?? locale, { style: "currency", currency }).format(Number(amount));
}

export function formatOdds(odds: Decimal | number | string, locale: string): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale] ?? locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(odds));
}

/** Round a payout down to cents so the house never over-pays by rounding. */
export function roundPayout(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
}

/** Parse a user-entered amount ("12,50" or "12.50") into a 2-dp Decimal. */
export function parseAmount(input: unknown): Decimal | null {
  if (typeof input !== "string" && typeof input !== "number") return null;
  const normalized = String(input).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = new Prisma.Decimal(normalized);
  return value.gt(0) ? value : null;
}
