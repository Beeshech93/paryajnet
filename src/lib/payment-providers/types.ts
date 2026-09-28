import type { Decimal } from "../money";
import type { Currency, PaymentMethod } from "../types";

export type DepositRequest = {
  paymentId: string;
  /** Short code the player quotes in the transfer. */
  reference: string;
  method: PaymentMethod;
  amount: Decimal;
  currency: Currency;
  payer: { name: string; email: string; phone?: string | null; documentNumber?: string | null };
};

export type WebhookEvent = { providerRef: string; status: "PAID" | "FAILED"; amount?: string };

/**
 * A payment provider integration. To add PIX / SPEI / OXXO through a real
 * provider, implement this interface and register it in ./index.ts.
 */
export interface PaymentProvider {
  name: string;
  createDeposit(p: DepositRequest): Promise<{ providerRef: string | null; instructions: Record<string, string> }>;
  /** Whether this provider can take deposits with the given method right now (defaults to true). */
  supports?(method: PaymentMethod): Promise<boolean>;
  /** Verify the webhook signature and translate it. Return null for events we ignore. */
  parseWebhook(rawBody: string, headers: Headers): Promise<WebhookEvent | null>;
}
