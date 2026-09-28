"use server";

import { getLocale } from "next-intl/server";
import { getCurrentUser, isSeller, sellerForAction } from "@/lib/auth";
import { orderInputSchema, type OrderInput } from "@/lib/order-schema";
import { cancelSale, createOrder, payOutCash } from "@/lib/orders";
import { AppError, type ActionResult } from "@/lib/types";
import { run } from "./run";

function parse(input: OrderInput) {
  const parsed = orderInputSchema.safeParse(input);
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === "adult")) throw new AppError("adult_required");
    throw new AppError("invalid_form");
  }
  return parsed.data;
}

/**
 * Creates a service. Public: the customer (no account) pays by PIX and the
 * WhatsApp agent sends the payment details. When a sales agent (or admin) is
 * signed in, it is a cash sale: confirmed at once and credited to that agent.
 */
export async function createOrderAction(input: OrderInput) {
  return run(async () => {
    const data = parse(input);
    const user = await getCurrentUser();
    const seller = isSeller(user) ? user! : undefined;
    const order = await createOrder({ ...data, locale: await getLocale() }, seller);
    return { code: order.code, sale: Boolean(seller) };
  });
}

function note(form: FormData) {
  const value = String(form.get("note") ?? "").trim();
  return value ? value.slice(0, 300) : null;
}

/** Agent/admin hands over the winnings of a cash sale and finalises it. */
export async function payOutCashAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await sellerForAction();
    await payOutCash(String(form.get("orderId")), user, note(form));
  });
}

/** The agent who sold it cancels a cash sale shortly after (returns the money). */
export async function cancelSaleAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await sellerForAction();
    await cancelSale(String(form.get("orderId")), user);
  });
}
