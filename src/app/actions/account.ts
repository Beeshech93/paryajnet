"use server";

import { getLocale } from "next-intl/server";
import { userForAction } from "@/lib/auth";
import { submitKyc } from "@/lib/kyc";
import { prisma } from "@/lib/db";
import { parseAmount } from "@/lib/money";
import { AppError, type ActionResult } from "@/lib/types";
import { getActiveCurrency, getOrCreateWallet } from "@/lib/wallet";
import { run } from "./run";

export async function setDepositLimitAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await userForAction();
    const currency = await getActiveCurrency(user, await getLocale());
    const raw = String(form.get("limit") ?? "").trim();
    const limit = raw === "" ? null : parseAmount(raw);
    if (raw !== "" && !limit) throw new AppError("invalid_amount");
    const wallet = await getOrCreateWallet(user.id, currency);
    // Lowering a limit applies immediately; raising or removing one waits 24h
    // in a regulated setup. Here we apply both immediately and log it.
    await prisma.wallet.update({ where: { id: wallet.id }, data: { dailyDepositLimit: limit } });
  });
}

const EXCLUSION_DAYS = [1, 7, 30, 180, 365] as const;

export async function selfExcludeAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await userForAction();
    const days = Number(form.get("days"));
    if (!EXCLUSION_DAYS.includes(days as (typeof EXCLUSION_DAYS)[number])) throw new AppError("invalid_form");
    if (form.get("confirm") !== "on") throw new AppError("confirm_required");
    const until = new Date(Date.now() + days * 24 * 60 * 60_000);
    // Never shorten an existing exclusion.
    if (user.selfExcludedUntil && user.selfExcludedUntil > until) return;
    await prisma.user.update({ where: { id: user.id }, data: { selfExcludedUntil: until } });
  });
}

export async function submitKycAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await userForAction();
    await submitKyc(user.id, {
      fullName: String(form.get("fullName") ?? ""),
      documentType: String(form.get("documentType") ?? ""),
      documentNumber: String(form.get("documentNumber") ?? ""),
      files: (["DOCUMENT_FRONT", "DOCUMENT_BACK", "SELFIE"] as const).map((kind) => ({
        kind,
        file: form.get(kind) as File | null,
      })),
    });
  });
}
