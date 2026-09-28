import { createPublicKey, verify } from "node:crypto";
import type { DepositRequest, PaymentProvider } from "./types";

/**
 * Conekta (Mexico): SPEI transfers and OXXO / convenience-store cash payments.
 * Docs: https://developers.conekta.com — API v2.3.0.
 *
 * Env:
 *   CONEKTA_PRIVATE_KEY         key_… (sandbox or live)
 *   CONEKTA_WEBHOOK_PUBLIC_KEY  PEM from POST /webhook_keys ("\n" escapes allowed)
 * Webhook URL to register in Conekta: https://<your-domain>/api/payments/webhook/conekta
 */
const API = "https://api.conekta.io";
const ACCEPT = "application/vnd.conekta-v2.3.0+json";
const EXPIRY_HOURS = 24;

type ConektaCharge = {
  payment_method: {
    type?: string;
    reference?: string;
    barcode_url?: string;
    receiving_account_number?: string;
    receiving_account_bank?: string;
    clabe?: string;
    expires_at?: number;
  };
};
type ConektaOrder = { id: string; amount: number; charges?: { data: ConektaCharge[] } };

function privateKey(): string {
  const key = process.env.CONEKTA_PRIVATE_KEY;
  if (!key) throw new Error("CONEKTA_PRIVATE_KEY is not set");
  return key;
}

async function conekta<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Accept: ACCEPT,
      "Content-Type": "application/json",
      "Accept-Language": "es",
      Authorization: `Basic ${Buffer.from(`${privateKey()}:`).toString("base64")}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (json as { details?: { message?: string }[] }).details?.[0]?.message;
    throw new Error(`Conekta ${res.status}: ${detail ?? "request failed"}`);
  }
  return json as T;
}

export const conektaProvider: PaymentProvider = {
  name: "conekta",

  async createDeposit(p: DepositRequest) {
    if (p.currency !== "MXN" || (p.method !== "SPEI" && p.method !== "OXXO")) {
      throw new Error(`Conekta does not support ${p.method} in ${p.currency}`);
    }
    const expiresAt = Math.floor(Date.now() / 1000) + EXPIRY_HOURS * 3600;
    const order = await conekta<ConektaOrder>("/orders", {
      currency: "MXN",
      line_items: [{ name: "Depósito ParyajNet", unit_price: Math.round(Number(p.amount) * 100), quantity: 1 }],
      customer_info: { name: p.payer.name, email: p.payer.email, ...(p.payer.phone ? { phone: p.payer.phone } : {}) },
      metadata: { payment_id: p.paymentId },
      charges: [{ payment_method: { type: p.method === "SPEI" ? "spei" : "cash", expires_at: expiresAt } }],
    });
    const pm = order.charges?.data[0]?.payment_method ?? {};
    const expires = new Date(expiresAt * 1000).toISOString();
    const instructions: Record<string, string> =
      p.method === "SPEI"
        ? {
            clabe: pm.receiving_account_number ?? pm.clabe ?? "",
            bank: pm.receiving_account_bank ?? "",
            beneficiary: "ParyajNet",
            expiresAt: expires,
          }
        : { reference: pm.reference ?? "", barcodeUrl: pm.barcode_url ?? "", expiresAt: expires };
    return { providerRef: order.id, instructions };
  },

  /** Conekta signs the raw body with RSA-SHA256 and sends it base64-encoded in the DIGEST header. */
  async parseWebhook(rawBody, headers) {
    const pem = process.env.CONEKTA_WEBHOOK_PUBLIC_KEY?.replace(/\\n/g, "\n");
    const signature = headers.get("digest");
    if (!pem || !signature) throw new Error("bad_signature");
    const ok = verify("sha256", Buffer.from(rawBody, "utf8"), createPublicKey(pem), Buffer.from(signature, "base64"));
    if (!ok) throw new Error("bad_signature");

    const event = JSON.parse(rawBody) as { type?: string; data?: { object?: ConektaOrder & { object?: string } } };
    const order = event.data?.object;
    if (!order?.id) return null;
    if (event.type === "order.paid") {
      return { providerRef: order.id, status: "PAID", amount: (order.amount / 100).toFixed(2) };
    }
    if (event.type === "order.expired" || event.type === "order.canceled" || event.type === "order.declined") {
      return { providerRef: order.id, status: "FAILED" };
    }
    return null;
  },
};
