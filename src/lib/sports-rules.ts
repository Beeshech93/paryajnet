import type { Outcome } from "./types";
import { Decimal, roundPayout } from "./money";

/**
 * Market types.
 *  1X2  match result            DC  double chance         ML  moneyline (no draw; a tie voids)
 *  OU   over/under a total line HCP handicap on the home side (whole lines can push)
 *  BTTS both teams to score     CS  correct score ("h-a" codes plus "OTHER")
 */
export const MARKET_TYPES = ["1X2", "DC", "ML", "OU", "HCP", "BTTS", "CS"] as const;
export type MarketType = (typeof MARKET_TYPES)[number];

export const FIXED_CODES: Partial<Record<MarketType, string[]>> = {
  "1X2": ["1", "X", "2"],
  DC: ["1X", "12", "X2"],
  ML: ["1", "2"],
  OU: ["OVER", "UNDER"],
  HCP: ["HOME", "AWAY"],
  BTTS: ["YES", "NO"],
};

export const LINE_MARKETS: MarketType[] = ["OU", "HCP"];

export const MAX_LEGS = 20;

export function isMarketType(value: string): value is MarketType {
  return (MARKET_TYPES as readonly string[]).includes(value);
}

export function marketKey(type: string, line?: Decimal | number | string | null): string {
  return line === null || line === undefined ? type : `${type}:${new Decimal(line).toString()}`;
}

const CS_CODE = /^\d{1,2}-\d{1,2}$/;

/** Validate a market definition. Returns an error code or null. */
export function validateMarket(type: string, line: number | null, codes: string[]): string | null {
  if (!isMarketType(type)) return "invalid_market";
  if (LINE_MARKETS.includes(type) !== (line !== null)) return "invalid_market";
  if (line !== null && (!Number.isFinite(line) || Math.round(line * 2) !== line * 2)) return "invalid_market";
  if (type === "OU" && line! <= 0) return "invalid_market";
  if (new Set(codes).size !== codes.length || codes.length < 2) return "invalid_market";
  const fixed = FIXED_CODES[type];
  if (fixed) return fixed.length === codes.length && fixed.every((c) => codes.includes(c)) ? null : "invalid_market";
  // Correct score: explicit scores plus an optional OTHER bucket.
  return codes.every((c) => c === "OTHER" || CS_CODE.test(c)) ? null : "invalid_market";
}

type MarketInfo = { type: string; line: Decimal | number | null; codes: string[] };

/** Resolve a selection from the final score. */
export function resolveSelection(
  market: MarketInfo,
  code: string,
  home: number,
  away: number,
): "WON" | "LOST" | "VOID" {
  const line = market.line === null ? 0 : Number(market.line);
  const win = (b: boolean) => (b ? "WON" : "LOST");
  switch (market.type) {
    case "1X2":
      return win((code === "1" && home > away) || (code === "X" && home === away) || (code === "2" && home < away));
    case "DC":
      return win(
        (code === "1X" && home >= away) || (code === "12" && home !== away) || (code === "X2" && home <= away),
      );
    case "ML":
      if (home === away) return "VOID";
      return win((code === "1" && home > away) || (code === "2" && home < away));
    case "OU": {
      const total = home + away;
      if (total === line) return "VOID";
      return win(code === "OVER" ? total > line : total < line);
    }
    case "HCP": {
      const diff = home + line - away;
      if (diff === 0) return "VOID";
      return win(code === "HOME" ? diff > 0 : diff < 0);
    }
    case "BTTS": {
      const both = home > 0 && away > 0;
      return win(code === "YES" ? both : !both);
    }
    case "CS": {
      const score = `${home}-${away}`;
      if (code === "OTHER") return win(!market.codes.includes(score));
      return win(code === score);
    }
    default:
      throw new Error(`Unknown market type ${market.type}`);
  }
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
