/**
 * Password recovery for back-office users (admins and sales agents).
 * A one-time link carries a random token; only its SHA-256 is stored. Using it
 * sets the new password and signs out every existing session of that user.
 */
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { routing } from "@/i18n/routing";
import { prisma } from "./db";
import { translator } from "./i18n-server";
import { sendMail } from "./mailer";
import { siteUrl } from "./site";
import { AppError } from "./types";

/** A link the user asked for by e-mail is valid this long… */
const EMAIL_TTL_MS = 60 * 60_000;
/** …and one an admin generated (sent by hand, e.g. WhatsApp) this long. */
const ADMIN_TTL_MS = 24 * 60 * 60_000;
/** Self-service requests per user per hour (stops mailbox flooding). */
const MAX_REQUESTS_PER_HOUR = 3;

export const PASSWORD_MIN = 8;
const PASSWORD_MAX = 100;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

function resetUrl(token: string, locale: string) {
  const loc = (routing.locales as readonly string[]).includes(locale) ? locale : routing.defaultLocale;
  return `${siteUrl()}/${loc}/reset/${token}`;
}

async function issue(userId: string, ttlMs: number, createdBy: string | null) {
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordReset.create({
    data: { userId, tokenHash: hash(token), expiresAt: new Date(Date.now() + ttlMs), createdBy },
  });
  return token;
}

/**
 * "Forgot my password": e-mails a link if the address belongs to an active
 * back-office user. Always silent, so the form can't be used to find accounts.
 */
export async function requestPasswordReset(rawEmail: string, locale: string) {
  const email = rawEmail.trim().toLowerCase();
  if (!email || email.length > 120) return;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.active || (user.role !== "ADMIN" && user.role !== "AGENT")) return;
  const recent = await prisma.passwordReset.count({
    where: { userId: user.id, createdBy: null, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } },
  });
  if (recent >= MAX_REQUESTS_PER_HOUR) return;
  const token = await issue(user.id, EMAIL_TTL_MS, null);
  const url = resetUrl(token, locale);
  const t = await translator(locale, "auth");
  const text = t("resetMailText", { name: user.name, url, minutes: EMAIL_TTL_MS / 60_000 });
  const html = `<p>${escapeHtml(t("resetMailHello", { name: user.name }))}</p>
<p>${escapeHtml(t("resetMailBody", { minutes: EMAIL_TTL_MS / 60_000 }))}</p>
<p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#38bdf8;color:#0b1220;border-radius:10px;font-weight:bold;text-decoration:none">${escapeHtml(t("resetMailCta"))}</a></p>
<p style="color:#64748b;font-size:12px">${escapeHtml(t("resetMailIgnore"))}</p>`;
  await sendMail(user.email, t("resetMailSubject"), text, html);
}

/** Admin generates a link for a user (to send by WhatsApp or in person). */
export async function createResetLink(userId: string, adminId: string, locale: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, role: { in: ["ADMIN", "AGENT"] } } });
  if (!user) throw new AppError("invalid_form");
  return resetUrl(await issue(user.id, ADMIN_TTL_MS, adminId), locale);
}

/** The reset and its user, if the token is still usable. */
export async function findValidReset(token: string) {
  if (!token || token.length > 100) return null;
  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: { select: { id: true, email: true, name: true, active: true } } },
  });
  if (!reset || reset.usedAt || reset.expiresAt < new Date() || !reset.user.active) return null;
  return reset;
}

export function checkNewPassword(password: string, confirm: string) {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) throw new AppError("password_too_short");
  if (password !== confirm) throw new AppError("passwords_mismatch");
}

/** Set a user's password and sign out all their sessions. */
export async function setPassword(userId: string, password: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 10), sessionsValidAfter: new Date() },
  });
}

export async function resetPassword(token: string, password: string, confirm: string) {
  checkNewPassword(password, confirm);
  const reset = await findValidReset(token);
  if (!reset) throw new AppError("reset_invalid");
  // Claim the token first so it can only be used once, even with two tabs.
  const claimed = await prisma.passwordReset.updateMany({
    where: { id: reset.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) throw new AppError("reset_invalid");
  await setPassword(reset.userId, password);
  // Any other outstanding links for this user stop working.
  await prisma.passwordReset.updateMany({
    where: { userId: reset.userId, usedAt: null },
    data: { usedAt: new Date() },
  });
  return reset.user;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
