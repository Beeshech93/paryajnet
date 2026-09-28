"use server";

import bcrypt from "bcryptjs";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { ageOn, createSession, destroySession, MIN_AGE } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError, CURRENCIES, type ActionResult } from "@/lib/types";
import { run } from "./run";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  birthDate: z.coerce.date(),
  currency: z.enum(CURRENCIES),
  terms: z.literal("on"),
});

export async function registerAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const locale = await getLocale();
  const result = await run(async () => {
    const parsed = registerSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) throw new AppError("invalid_form");
    const { name, email, password, birthDate, currency } = parsed.data;
    if (ageOn(birthDate) < MIN_AGE) throw new AppError("underage", { age: MIN_AGE });
    if (await prisma.user.findUnique({ where: { email } })) throw new AppError("email_taken");
    const user = await prisma.user.create({
      data: {
        name,
        email,
        birthDate,
        passwordHash: await bcrypt.hash(password, 12),
        preferredCurrency: currency,
        wallets: { create: [{ currency }] },
      },
    });
    await createSession(user.id, "USER");
  });
  if (result.ok) redirect({ href: "/", locale });
  return result;
}

export async function loginAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const locale = await getLocale();
  const result = await run(async () => {
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new AppError("bad_credentials");
    await createSession(user.id, user.role as "USER" | "ADMIN");
  });
  if (result.ok) redirect({ href: "/", locale });
  return result;
}

export async function logoutAction() {
  await destroySession();
  redirect({ href: "/", locale: await getLocale() });
}
