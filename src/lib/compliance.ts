/**
 * SPORTSBOOK PRO — MANDATORY COMPLIANCE & DEMO-ONLY POLICY GUARD
 *
 * HARD CONSTRAINTS:
 * 1. The entire platform operates with simulated demo credits only.
 * 2. Real-money operations (betting, deposits, withdrawals, cash prizes) are strictly disabled at code level.
 * 3. Cannot be overridden or enabled by environment variables, runtime flags, or administrative toggles.
 * 4. Simulated credits are strictly non-purchasable, non-transferable, and non-redeemable.
 */

export const REAL_MONEY_ENABLED = false as const;
export const REAL_SPORTSBOOK_ENABLED = false as const;
export const REAL_CASINO_ENABLED = false as const;
export const REAL_DEPOSITS_ENABLED = false as const;
export const REAL_WITHDRAWALS_ENABLED = false as const;
export const CASH_PRIZES_ENABLED = false as const;

export class RealMoneyDisabledError extends Error {
  public readonly code = "REAL_MONEY_OPERATIONS_DISABLED";
  public readonly statusCode = 403;

  constructor(message: string = "Real-money transactions and payouts are permanently disabled. SPORTSBOOK PRO operates in DEMO MODE with simulated credits only.") {
    super(message);
    this.name = "RealMoneyDisabledError";
  }
}

/**
 * Asserts at runtime that real-money operations remain strictly disabled.
 * Throws RealMoneyDisabledError if any unauthorized attempt is made to bypass this restriction.
 */
export function assertDemoOnly(): void {
  if (
    REAL_MONEY_ENABLED !== false ||
    REAL_SPORTSBOOK_ENABLED !== false ||
    REAL_CASINO_ENABLED !== false ||
    REAL_DEPOSITS_ENABLED !== false ||
    REAL_WITHDRAWALS_ENABLED !== false ||
    CASH_PRIZES_ENABLED !== false
  ) {
    throw new RealMoneyDisabledError("Critical Security Alert: Real-money flags have been tampered with. System locked.");
  }
}

/**
 * Guard for any deposit attempt. Always rejects.
 */
export function blockRealMoneyDeposit(amount: unknown, currency?: string): never {
  assertDemoOnly();
  throw new RealMoneyDisabledError(
    `Deposit of ${String(amount)} ${currency || "credits"} rejected: Real-money deposits are prohibited. Please claim free simulated demo credits via the Demo Faucet.`
  );
}

/**
 * Guard for any withdrawal attempt. Always rejects.
 */
export function blockRealMoneyWithdrawal(amount: unknown, destination?: string): never {
  assertDemoOnly();
  throw new RealMoneyDisabledError(
    `Withdrawal of ${String(amount)} to ${destination || "destination"} rejected: Simulated demo credits cannot be withdrawn or converted to fiat currency.`
  );
}

/**
 * Guard for real cash wager attempts.
 */
export function assertDemoWagerOnly(isRealMoneyWagerRequested: boolean): void {
  assertDemoOnly();
  if (isRealMoneyWagerRequested) {
    throw new RealMoneyDisabledError("Real money wagers are strictly prohibited. Only simulated demo credits are accepted.");
  }
}

/**
 * Demo policy metadata for UI and auditing.
 */
export const DEMO_POLICY_CONFIG = {
  isDemoMode: true,
  badgeText: "DEMO MODE",
  legalNotice: "SPORTSBOOK PRO is an entertainment platform operating exclusively with simulated demo credits. No real money gambling, cash deposits, or fiat prize redemptions are offered or permitted.",
  supportedCurrencies: [
    { code: "MXN", name: "Mexican Peso (Simulated)", symbol: "MX$", country: "MX", flag: "🇲🇽" },
    { code: "HTG", name: "Haitian Gourde (Simulated)", symbol: "G", country: "HT", flag: "🇭🇹" },
    { code: "USD", name: "US Dollar (Simulated)", symbol: "$", country: "GLOBAL", flag: "🌐" },
  ],
  initialDemoBalance: 5000,
  faucetClaimAmount: 1000,
} as const;

