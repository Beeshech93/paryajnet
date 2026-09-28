import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { evolutionConfig } from "@/lib/evolution";
import { Decimal, formatMoney } from "@/lib/money";
import { expireOverdue } from "@/lib/orders";

const zero = new Decimal(0);

export default async function AdminOverview() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("admin")]);
  await expireOverdue();

  const count = (status: string | string[]) =>
    prisma.order.count({ where: { status: Array.isArray(status) ? { in: status } : status } });
  const [awaiting, receipts, toPay, active, stakes, paidOut, failed] = await Promise.all([
    count("AWAITING_PAYMENT"),
    count("RECEIPT_RECEIVED"),
    count(["WON", "VOID"]),
    count("CONFIRMED"),
    prisma.order.aggregate({
      where: { status: { in: ["CONFIRMED", "WON", "LOST", "VOID", "PAID"] } },
      _sum: { amount: true },
    }),
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { payout: true } }),
    prisma.whatsAppMessage.count({
      where: { status: "FAILED", createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    }),
  ]);
  const owed = await prisma.order.aggregate({ where: { status: { in: ["WON", "VOID"] } }, _sum: { payout: true } });

  const kpis = [
    { label: t("kpi.receipts"), value: receipts, href: "/admin/orders?status=RECEIPT_RECEIVED", alert: receipts > 0 },
    { label: t("kpi.toPay"), value: toPay, href: "/admin/orders?status=PAYOUT", alert: toPay > 0 },
    { label: t("kpi.awaiting"), value: awaiting, href: "/admin/orders?status=AWAITING_PAYMENT" },
    { label: t("kpi.active"), value: active, href: "/admin/orders?status=CONFIRMED" },
  ];
  const money = [
    { label: t("kpi.stakes"), value: stakes._sum.amount ?? zero },
    { label: t("kpi.paidOut"), value: paidOut._sum.payout ?? zero },
    { label: t("kpi.owed"), value: owed._sum.payout ?? zero },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">{t("overview")}</h1>
      {!evolutionConfig() && (
        <Link href="/admin/whatsapp" className="block rounded-2xl bg-gold/15 p-4 text-sm text-gold-strong">
          ⚠️ {t("whatsapp.notConfigured")}
        </Link>
      )}
      {failed > 0 && (
        <Link href="/admin/whatsapp" className="block rounded-2xl bg-danger/15 p-4 text-sm text-danger">
          {t("whatsapp.failedRecent", { count: failed })}
        </Link>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="card p-4 transition hover:border-brand">
            <p className="text-xs text-muted">{k.label}</p>
            <p className={`mt-1 font-display text-3xl font-bold tabular-nums ${k.alert ? "text-gold-strong" : ""}`}>
              {k.value}
            </p>
          </Link>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {money.map((m) => (
          <div key={m.label} className="card p-4">
            <p className="text-xs text-muted">{m.label}</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">{formatMoney(m.value, locale)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
