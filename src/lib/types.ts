/** The platform operates in Brazil only: amounts are in reais, paid by PIX. */
export const CURRENCY = "BRL";

export type Role = "ADMIN";
export type OrderStatus =
  "AWAITING_PAYMENT" | "RECEIPT_RECEIVED" | "CONFIRMED" | "WON" | "LOST" | "VOID" | "PAID" | "REJECTED" | "EXPIRED";
export type Outcome = "PENDING" | "WON" | "LOST" | "VOID";
export type BetStatus = "OPEN" | "WON" | "LOST" | "VOID";

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
