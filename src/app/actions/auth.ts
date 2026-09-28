"use server";

import bcrypt from "bcryptjs";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createSession, destroySession, homeFor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError, type ActionResult, type Role } from "@/lib/types";
import { run } from "./run";

/** Back-office login (admins and sales agents). Customers don't have accounts. */
export async function loginAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const locale = await getLocale();
  let home = "/admin";
  const result = await run(async () => {
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");
    const user = await prisma.user.findUnique({ where: { email } });
    const staff = user?.active && (user.role === "ADMIN" || user.role === "AGENT");
    if (!user || !staff || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError("bad_credentials");
    }
    await createSession(user.id, user.role as Role);
    home = homeFor(user.role);
  });
  if (result.ok) redirect({ href: home, locale });
  return result;
}

export async function logoutAction() {
  await destroySession();
  redirect({ href: "/", locale: await getLocale() });
}
