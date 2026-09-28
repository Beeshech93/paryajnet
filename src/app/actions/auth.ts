"use server";

import bcrypt from "bcryptjs";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createSession, destroySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError, type ActionResult } from "@/lib/types";
import { run } from "./run";

/** Back-office login. Customers don't have accounts. */
export async function loginAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const locale = await getLocale();
  const result = await run(async () => {
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== "ADMIN" || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError("bad_credentials");
    }
    await createSession(user.id, "ADMIN");
  });
  if (result.ok) redirect({ href: "/admin", locale });
  return result;
}

export async function logoutAction() {
  await destroySession();
  redirect({ href: "/", locale: await getLocale() });
}
