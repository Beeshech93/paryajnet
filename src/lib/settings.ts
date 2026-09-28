import { prisma } from "./db";

/** Payment settings editable from /admin/settings. */
export const PAYMENT_SETTING_KEYS = ["pix.keyType", "pix.key", "pix.name", "pix.city", "pix.bank"] as const;
export type PaymentSettingKey = (typeof PAYMENT_SETTING_KEYS)[number];
export type PaymentSettings = Partial<Record<PaymentSettingKey, string>>;

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const rows = await prisma.setting.findMany({ where: { key: { in: [...PAYMENT_SETTING_KEYS] } } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function savePaymentSettings(values: PaymentSettings) {
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      value
        ? prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
        : prisma.setting.deleteMany({ where: { key } }),
    ),
  );
}

// ---------- Generic settings ----------

export async function getSetting(key: string): Promise<string | null> {
  return (await prisma.setting.findUnique({ where: { key } }))?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/** Take a short-lived lock stored in settings; returns false if someone else holds it. */
export async function tryLock(key: string, ttlMs: number): Promise<boolean> {
  const now = Date.now();
  const current = Number(await getSetting(key));
  if (current && now - current < ttlMs) return false;
  await setSetting(key, String(now));
  return true;
}

export async function unlock(key: string) {
  await prisma.setting.deleteMany({ where: { key } });
}
