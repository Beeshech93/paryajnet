import { randomBytes } from "node:crypto";
import { hmacHex, safeEqual } from "../api-auth";
import type { PaymentProvider } from "./types";

/** Development provider: realistic-looking instructions, no money moves. */
export const mockProvider: PaymentProvider = {
  name: "mock",
  async createDeposit({
    paymentId,
    method,
    amount,
  }): Promise<{ providerRef: string; instructions: Record<string, string> }> {
    const ref = randomBytes(6).toString("hex").toUpperCase();
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    switch (method) {
      case "PIX":
        return {
          providerRef: `pix_${ref}`,
          instructions: {
            pixCode: `00020126580014BR.GOV.BCB.PIX0136${paymentId}5204000053039865406${amount.toFixed(2)}5802BR5909PARYAJNET6009SAO PAULO62070503***6304${ref.slice(0, 4)}`,
            expiresAt,
          },
        };
      case "SPEI":
        return {
          providerRef: `spei_${ref}`,
          instructions: {
            clabe: `646180${String(parseInt(ref, 16)).padStart(12, "0").slice(0, 12)}`,
            reference: ref.slice(0, 7),
            beneficiary: "ParyajNet",
          },
        };
      case "OXXO":
        return {
          providerRef: `oxxo_${ref}`,
          instructions: { reference: String(parseInt(ref, 16)).padStart(14, "0").slice(0, 14), expiresAt },
        };
    }
  },
  /**
   * Generic signed webhook, also usable by a relay in front of a real provider:
   * body {"providerRef","status":"PAID"|"FAILED","amount"} and header
   * x-paryajnet-signature = hex HMAC-SHA256(PAYMENTS_WEBHOOK_SECRET, body).
   */
  async parseWebhook(rawBody, headers) {
    const secret = process.env.PAYMENTS_WEBHOOK_SECRET;
    const signature = headers.get("x-paryajnet-signature") ?? "";
    if (!secret || !safeEqual(signature, hmacHex(secret, rawBody))) throw new Error("bad_signature");
    const body = JSON.parse(rawBody) as { providerRef?: string; status?: string; amount?: string };
    if (!body.providerRef || (body.status !== "PAID" && body.status !== "FAILED")) return null;
    return { providerRef: body.providerRef, status: body.status, amount: body.amount };
  },
};
