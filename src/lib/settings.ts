import { prisma } from "./db";

/** Payment settings editable from /admin/settings. */
export const PAYMENT_SETTING_KEYS = [
  "pix.keyType",
  "pix.key",
  "pix.name",
  "pix.city",
  "pix.bank",
  "spei.clabe",
  "spei.name",
  "spei.bank",
] as const;
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
