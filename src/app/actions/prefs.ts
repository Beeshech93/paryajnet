"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isCurrency } from "@/lib/types";
import { CURRENCY_COOKIE, getOrCreateWallet } from "@/lib/wallet";

export async function setCurrencyAction(currency: string) {
  if (!isCurrency(currency)) return;
  (await cookies()).set(CURRENCY_COOKIE, currency, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const user = await getCurrentUser();
  if (user) {
    await getOrCreateWallet(user.id, currency);
    await prisma.user.update({ where: { id: user.id }, data: { preferredCurrency: currency } });
  }
  revalidatePath("/", "layout");
}
