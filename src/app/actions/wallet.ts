"use server";

import { getLocale } from "next-intl/server";
import { assertCanPlay, userForAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseAmount } from "@/lib/money";
import { attachReceipt, confirmDeposit, createDeposit, requestWithdrawal } from "@/lib/payments";
import { AppError, type ActionResult, type PaymentMethod } from "@/lib/types";
import { getActiveCurrency } from "@/lib/wallet";
import { run } from "./run";

export async function depositAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await userForAction();
    assertCanPlay(user);
    const currency = await getActiveCurrency(user, await getLocale());
    const amount = parseAmount(form.get("amount"));
    if (!amount) throw new AppError("invalid_amount");
    await createDeposit(user.id, currency, String(form.get("method")) as PaymentMethod, amount);
  });
}

export async function withdrawAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await userForAction();
    const currency = await getActiveCurrency(user, await getLocale());
    const amount = parseAmount(form.get("amount"));
    if (!amount) throw new AppError("invalid_amount");
    await requestWithdrawal(
      user.id,
      currency,
      String(form.get("method")) as PaymentMethod,
      amount,
      String(form.get("destination") ?? ""),
      String(form.get("pixKeyType") ?? ""),
    );
  });
}

/** Development only: pretend the provider confirmed the player's payment. */
export async function simulatePaymentAction(paymentId: string) {
  return run(async () => {
    const user = await userForAction();
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    // Only payments handled by the mock provider can be simulated, and never in production.
    if (
      !payment ||
      payment.userId !== user.id ||
      payment.provider !== "mock" ||
      process.env.NODE_ENV === "production"
    ) {
      throw new AppError("forbidden");
    }
    await confirmDeposit(paymentId);
  });
}

export async function attachReceiptAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await userForAction();
    await attachReceipt(
      user.id,
      String(form.get("paymentId")),
      String(form.get("note") ?? ""),
      form.get("receipt") as File | null,
    );
  });
}
