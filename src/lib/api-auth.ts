import { createHmac, timingSafeEqual } from "node:crypto";

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  return safeEqual(header.slice(7), secret);
}

export function hmacHex(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}
