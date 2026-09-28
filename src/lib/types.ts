export const CURRENCIES = ["BRL", "MXN"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Role = "USER" | "ADMIN";
export type TxType = "DEPOSIT" | "WITHDRAWAL" | "BET" | "WIN" | "REFUND" | "ADJUSTMENT";
export type PaymentKind = "DEPOSIT" | "WITHDRAWAL";
export type PaymentMethod = "PIX" | "SPEI" | "OXXO";
export type PaymentStatus = "PENDING" | "COMPLETED" | "REJECTED";
export type Outcome = "PENDING" | "WON" | "LOST" | "VOID";
export type BetStatus = "OPEN" | "WON" | "LOST" | "VOID";

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

/** Error with a stable code that the UI translates via `errors.<code>`. */
export class AppError extends Error {
  constructor(
    public code: string,
    public params: Record<string, string | number> = {},
  ) {
    super(code);
  }
}

export type ActionResult<T = unknown> =
  { ok: true; data?: T } | { ok: false; error: string; params?: Record<string, string | number> };

export function toActionError(err: unknown): { ok: false; error: string; params?: Record<string, string | number> } {
  if (err instanceof AppError) return { ok: false, error: err.code, params: err.params };
  console.error(err);
  return { ok: false, error: "unexpected" };
}
