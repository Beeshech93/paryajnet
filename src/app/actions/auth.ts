"use server";

import bcrypt from "bcryptjs";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createSession, destroySession, homeFor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requestPasswordReset, resetPassword } from "@/lib/password-reset";
import { requestAccount } from "@/lib/signup";
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
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new AppError("bad_credentials");
    // Only once the password is right: say why a real account can't sign in yet.
    if (user.pendingApproval) throw new AppError("account_pending");
    if (!user.active || (user.role !== "ADMIN" && user.role !== "AGENT")) throw new AppError("account_disabled");
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

/** "Forgot my password": always answers the same, whether or not the e-mail exists. */
export async function forgotPasswordAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const locale = await getLocale();
  return run(() => requestPasswordReset(String(form.get("email") ?? ""), locale));
}

/** New password from a recovery link; signs the user in. */
export async function resetPasswordAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const locale = await getLocale();
  let home = "/admin";
  const result = await run(async () => {
    const user = await resetPassword(
      String(form.get("token") ?? ""),
      String(form.get("password") ?? ""),
      String(form.get("confirm") ?? ""),
    );
    const full = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    await createSession(full.id, full.role as Role);
    home = homeFor(full.role);
  });
  if (result.ok) redirect({ href: home, locale });
  return result;
}

/** Public account request; an admin must approve it before it can sign in. */
export async function signupAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const locale = await getLocale();
  const field = (k: string) => String(form.get(k) ?? "");
  return run(() =>
    requestAccount({
      name: field("name"),
      email: field("email"),
      password: field("password"),
      confirm: field("confirm"),
      locale,
    }),
  );
}
