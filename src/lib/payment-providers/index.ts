import { mockProvider } from "./mock";
import type { PaymentProvider } from "./types";

const providers: Record<string, PaymentProvider> = {
  mock: mockProvider,
  // e.g. "mercadopago": mercadoPagoProvider, "conekta": conektaProvider, …
};

export function activeProvider(): PaymentProvider {
  const name = process.env.PAYMENTS_PROVIDER ?? "mock";
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown PAYMENTS_PROVIDER "${name}"`);
  return provider;
}

export type { PaymentProvider, WebhookEvent } from "./types";
