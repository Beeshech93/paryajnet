import QRCode from "qrcode";
import { pixBrCode } from "../pix";
import { getPaymentSettings } from "../settings";
import type { PaymentProvider } from "./types";

/**
 * Manual payments: the player transfers to the operator's own PIX key or
 * CLABE, quoting the deposit reference, and an admin confirms the deposit
 * once the money has arrived (/admin/payments). No webhooks.
 */
export const manualProvider: PaymentProvider = {
  name: "manual",

  async supports(method) {
    const s = await getPaymentSettings();
    if (method === "PIX") return !!(s["pix.key"] && s["pix.name"]);
    if (method === "SPEI") return !!(s["spei.clabe"] && s["spei.name"]);
    return false; // OXXO needs a provider that issues references
  },

  async createDeposit({
    method,
    amount,
    reference,
  }): Promise<{ providerRef: string | null; instructions: Record<string, string> }> {
    const s = await getPaymentSettings();
    if (method === "PIX" && s["pix.key"] && s["pix.name"]) {
      const pixCode = pixBrCode({
        key: s["pix.key"],
        name: s["pix.name"],
        city: s["pix.city"] ?? "BRASIL",
        amount: amount.toFixed(2),
        txid: reference,
      });
      return {
        providerRef: null,
        instructions: {
          pixCode,
          pixQr: await QRCode.toString(pixCode, { type: "svg", margin: 1, errorCorrectionLevel: "M" }),
          pixKey: s["pix.key"],
          pixKeyType: s["pix.keyType"] ?? "",
          beneficiary: s["pix.name"],
          bank: s["pix.bank"] ?? "",
          reference,
        },
      };
    }
    if (method === "SPEI" && s["spei.clabe"] && s["spei.name"]) {
      return {
        providerRef: null,
        instructions: {
          clabe: s["spei.clabe"],
          beneficiary: s["spei.name"],
          bank: s["spei.bank"] ?? "",
          reference,
        },
      };
    }
    throw new Error(`Manual payments are not configured for ${method}`);
  },

  async parseWebhook() {
    return null;
  },
};
