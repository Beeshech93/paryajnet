import { Decimal, roundPayout } from "./money";

export const LOTTERY_TYPES = ["BORLETTE", "LOTO3", "MARIAGE"] as const;
export type LotteryType = (typeof LOTTERY_TYPES)[number];

/** Payout multipliers (stake × multiplier). */
export const LOTTERY_PAYOUTS = {
  BORLETTE: [50, 20, 10], // 1st, 2nd, 3rd lot
  LOTO3: 500,
  MARIAGE: 1000,
} as const;

export const MAX_LINES = 20;

export type DrawResult = { first: string; second: string; third: string };

/** Normalise and validate a line's numbers. Returns null when invalid. */
export function normalizeNumbers(type: LotteryType, raw: string): string | null {
  const value = raw.trim();
  if (type === "BORLETTE") return /^\d{2}$/.test(value) ? value : null;
  if (type === "LOTO3") return /^\d{3}$/.test(value) ? value : null;
  const m = value.match(/^(\d{2})\s*[-x ]\s*(\d{2})$/);
  if (!m || m[1] === m[2]) return null;
  return `${m[1]}-${m[2]}`;
}

export function isValidResult(r: DrawResult): boolean {
  return /^\d{3}$/.test(r.first) && /^\d{2}$/.test(r.second) && /^\d{2}$/.test(r.third);
}

export function lots(r: DrawResult): [string, string, string] {
  return [r.first.slice(1), r.second, r.third];
}

/** Multiplier a line earns for a given draw result (0 = lost). */
export function lineMultiplier(type: LotteryType, numbers: string, r: DrawResult): number {
  const drawn = lots(r);
  switch (type) {
    case "BORLETTE":
      return drawn.reduce((sum, lot, i) => (lot === numbers ? sum + LOTTERY_PAYOUTS.BORLETTE[i] : sum), 0);
    case "LOTO3":
      return numbers === r.first ? LOTTERY_PAYOUTS.LOTO3 : 0;
    case "MARIAGE": {
      const [a, b] = numbers.split("-");
      return drawn.includes(a) && drawn.includes(b) ? LOTTERY_PAYOUTS.MARIAGE : 0;
    }
  }
}

export function linePayout(type: LotteryType, numbers: string, stake: Decimal, r: DrawResult): Decimal {
  return roundPayout(stake.mul(lineMultiplier(type, numbers, r)));
}

/** Highest possible payout for a line, used to enforce max-payout limits. */
export function maxLinePayout(type: LotteryType, stake: Decimal): Decimal {
  const best =
    type === "BORLETTE"
      ? LOTTERY_PAYOUTS.BORLETTE.reduce((a, b) => a + b, 0)
      : type === "LOTO3"
        ? LOTTERY_PAYOUTS.LOTO3
        : LOTTERY_PAYOUTS.MARIAGE;
  return stake.mul(best);
}
