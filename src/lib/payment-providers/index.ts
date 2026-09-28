import type { PaymentMethod } from "../types";
import { conektaProvider } from "./conekta";
import { manualProvider } from "./manual";
import { mockProvider } from "./mock";
import type { PaymentProvider } from "./types";

export const providers: Record<string, PaymentProvider> = {
  manual: manualProvider,
  mock: mockProvider,
  conekta: conektaProvider,
  // PIX provider goes here once chosen (e.g. "efi", "mercadopago", "stark").
};

/**
 * Providers are chosen per market:
 *   PAYMENTS_PROVIDER_PIX  → PIX (Brazil)
 *   PAYMENTS_PROVIDER_MX   → SPEI / OXXO (Mexico)
 * Both fall back to PAYMENTS_PROVIDER, then to "manual" (admin-confirmed transfers).
 */
export function providerFor(method: PaymentMethod): PaymentProvider {
  const specific = method === "PIX" ? process.env.PAYMENTS_PROVIDER_PIX : process.env.PAYMENTS_PROVIDER_MX;
  let name = specific || process.env.PAYMENTS_PROVIDER || "manual";
  // The mock provider lets players confirm their own deposits: development only.
  if (name === "mock" && process.env.NODE_ENV === "production") name = "manual";
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown payment provider "${name}"`);
  return provider;
}

export function providerByName(name: string): PaymentProvider | null {
  return providers[name] ?? null;
}

export type { PaymentProvider, WebhookEvent } from "./types";

/** Deposit methods a currency can use right now with the configured providers. */
export async function availableDepositMethods(methods: PaymentMethod[]): Promise<PaymentMethod[]> {
  const ok = await Promise.all(methods.map(async (m) => (await providerFor(m).supports?.(m)) ?? true));
  return methods.filter((_, i) => ok[i]);
}
