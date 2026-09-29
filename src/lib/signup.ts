/**
 * Account requests from the site. A request creates an inactive user that
 * can't sign in until an admin approves it (choosing agent or admin) —
 * nobody can give themselves back-office access.
 */
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { translator } from "./i18n-server";
import { sendMail } from "./mailer";
import { checkNewPassword } from "./password-reset";
import { siteUrl } from "./site";
import { AppError } from "./types";

/** Stop floods of fake requests: new requests are refused beyond this many waiting. */
const MAX_PENDING = 30;

export async function requestAccount(input: {
  name: string;
  email: string;
  password: string;
  confirm: string;
  locale: string;
}) {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) throw new AppError("invalid_name");
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) throw new AppError("invalid_email");
  checkNewPassword(input.password, input.confirm);
  if ((await prisma.user.count({ where: { pendingApproval: true } })) >= MAX_PENDING) {
    throw new AppError("signup_closed");
  }
  // Same answer whether or not the e-mail is taken, so the form can't reveal accounts.
  if (await prisma.user.findUnique({ where: { email } })) return;
  await prisma.user.create({
    data: {
      name,
      email,
      role: "AGENT",
      active: false,
      pendingApproval: true,
      passwordHash: await bcrypt.hash(input.password, 10),
    },
  });
  await notifyAdmins(name, email);
}

async function notifyAdmins(name: string, email: string) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true }, select: { email: true } });
  const t = await translator("pt", "auth");
  const url = `${siteUrl()}/pt/admin/agents`;
  for (const a of admins) {
    await sendMail(
      a.email,
      t("signupMailSubject", { name }),
      t("signupMailText", { name, email, url }),
      `<p>${t("signupMailText", { name, email, url }).replace(/\n/g, "<br>")}</p>`,
    );
  }
}

/** Admin approves a request as agent or admin. */
export async function approveAccount(userId: string, role: "AGENT" | "ADMIN") {
  const res = await prisma.user.updateMany({
    where: { id: userId, pendingApproval: true },
    data: { pendingApproval: false, active: true, role },
  });
  if (res.count === 0) throw new AppError("invalid_form");
}

/** Admin rejects a request: the account is deleted (it never had any activity). */
export async function rejectAccount(userId: string) {
  const res = await prisma.user.deleteMany({ where: { id: userId, pendingApproval: true } });
  if (res.count === 0) throw new AppError("invalid_form");
}
