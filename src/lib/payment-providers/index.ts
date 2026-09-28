import type { PaymentMethod } from "../types";
import { conektaProvider } from "./conekta";
import { mockProvider } from "./mock";
import type { PaymentProvider } from "./types";

export const providers: Record<string, PaymentProvider> = {
  mock: mockProvider,
  conekta: conektaProvider,
  // PIX provider goes here once chosen (e.g. "efi", "mercadopago", "stark").
};

/**
 * Providers are chosen per market:
 *   PAYMENTS_PROVIDER_PIX  → PIX (Brazil)
 *   PAYMENTS_PROVIDER_MX   → SPEI / OXXO (Mexico)
 * Both fall back to PAYMENTS_PROVIDER, then to "mock".
 */
export function providerFor(method: PaymentMethod): PaymentProvider {
  const specific = method === "PIX" ? process.env.PAYMENTS_PROVIDER_PIX : process.env.PAYMENTS_PROVIDER_MX;
  const name = specific || process.env.PAYMENTS_PROVIDER || "mock";
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown payment provider "${name}"`);
  return provider;
}

export function providerByName(name: string): PaymentProvider | null {
  return providers[name] ?? null;
}

export type { PaymentProvider, WebhookEvent } from "./types";
