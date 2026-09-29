import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "./db";
import { AppError, type Role } from "./types";

const COOKIE = "pj_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value === "change-me") throw new Error("AUTH_SECRET is not configured");
  return new TextEncoder().encode(value);
}

export async function createSession(userId: string, role: Role) {
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

async function readSession(): Promise<{ userId: string; issuedAt: number } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.sub ? { userId: payload.sub, issuedAt: payload.iat ?? 0 } : null;
  } catch {
    return null;
  }
}

/** The signed-in user, loaded once per request. Role and status are always read from the DB. */
export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.active) return null;
  // Sessions from before the last password change are signed out (JWT iat is in seconds).
  if (user.sessionsValidAfter && session.issuedAt < Math.floor(user.sessionsValidAfter.getTime() / 1000)) return null;
  return user;
});

/** Admins and sales agents can sell for cash and finalise cash sales. */
export const isSeller = (user: { role: string } | null | undefined) => user?.role === "ADMIN" || user?.role === "AGENT";

/** Where a back-office user lands after signing in. */
export const homeFor = (role: string) => (role === "AGENT" ? "/agent" : "/admin");

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login", locale: await getLocale() });
  return user!;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect({ href: homeFor(user.role), locale: await getLocale() });
  return user;
}

export async function requireSeller() {
  const user = await requireUser();
  if (!isSeller(user)) redirect({ href: "/", locale: await getLocale() });
  return user;
}

/** For server actions: throw instead of redirecting. */
export async function userForAction() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("not_signed_in");
  return user;
}

export async function adminForAction() {
  const user = await userForAction();
  if (user.role !== "ADMIN") throw new AppError("forbidden");
  return user;
}

export async function sellerForAction() {
  const user = await userForAction();
  if (!isSeller(user)) throw new AppError("forbidden");
  return user;
}
