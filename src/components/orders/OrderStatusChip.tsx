import { getTranslations } from "next-intl/server";

const TONE: Record<string, string> = {
  AWAITING_PAYMENT: "bg-surface-2 text-muted",
  RECEIPT_RECEIVED: "bg-gold/15 text-gold-strong",
  CONFIRMED: "bg-brand/15 text-brand-strong",
  WON: "bg-gold text-brand-ink",
  VOID: "bg-gold/15 text-gold-strong",
  LOST: "bg-surface-2 text-muted",
  PAID: "bg-brand/15 text-brand-strong",
  REJECTED: "bg-danger/15 text-danger",
  EXPIRED: "bg-danger/15 text-danger",
  CANCELLED: "bg-surface-2 text-muted",
};

export async function OrderStatusChip({ status }: { status: string }) {
  const t = await getTranslations("orders");
  return <span className={`chip whitespace-nowrap ${TONE[status] ?? ""}`}>{t(`status.${status}`)}</span>;
}
