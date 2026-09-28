import type { Outcome } from "./types";
import { Decimal, roundPayout } from "./money";

export const MARKET_TYPES = {
  "1X2": ["1", "X", "2"],
  OU25: ["OVER", "UNDER"],
  BTTS: ["YES", "NO"],
} as const;
export type MarketType = keyof typeof MARKET_TYPES;

export const MAX_LEGS = 20;

/** Resolve a selection from the final score. */
export function resolveSelection(marketType: string, code: string, home: number, away: number): "WON" | "LOST" {
  let won: boolean;
  switch (marketType) {
    case "1X2":
      won = (code === "1" && home > away) || (code === "X" && home === away) || (code === "2" && home < away);
      break;
    case "OU25":
      won = (code === "OVER" && home + away > 2.5) || (code === "UNDER" && home + away < 2.5);
      break;
    case "BTTS": {
      const both = home > 0 && away > 0;
      won = (code === "YES" && both) || (code === "NO" && !both);
      break;
    }
    default:
      throw new Error(`Unknown market type ${marketType}`);
  }
  return won ? "WON" : "LOST";
}

export function combinedOdds(odds: Decimal[]): Decimal {
  return odds.reduce((acc, o) => acc.mul(o), new Decimal(1)).toDecimalPlaces(2, Decimal.ROUND_DOWN);
}

/**
 * Work out a bet's state from its legs. Void legs count as odds 1.00;
 * a single lost leg loses the bet; the bet stays open while any leg is pending.
 */
export function evaluateBet(
  stake: Decimal,
  legs: { odds: Decimal; result: Outcome }[],
): { status: "OPEN" | "WON" | "LOST" | "VOID"; payout: Decimal | null } {
  if (legs.some((l) => l.result === "LOST")) return { status: "LOST", payout: new Decimal(0) };
  if (legs.some((l) => l.result === "PENDING")) return { status: "OPEN", payout: null };
  if (legs.every((l) => l.result === "VOID")) return { status: "VOID", payout: stake };
  // Same rounding as at placement, so a fully-won bet pays exactly the potential win shown.
  const odds = combinedOdds(legs.filter((l) => l.result === "WON").map((l) => l.odds));
  return { status: "WON", payout: roundPayout(stake.mul(odds)) };
}
