import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { LocalTime } from "@/components/LocalTime";
import { OrderStatusChip } from "@/components/orders/OrderStatusChip";
import { requireSeller } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, type Decimal } from "@/lib/money";
import { expireOverdue } from "@/lib/orders";
import { findOrderCode } from "@/lib/orders-rules";
import { cashSummary, startOfBrDay } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function AgentPanel({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const [user, locale, t] = await Promise.all([requireSeller(), getLocale(), getTranslations("sale")]);
  const { code: raw } = await searchParams;
  let notFound = false;
  if (raw) {
    const code =
      findOrderCode(raw) ??
      raw
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
    const order = code ? await prisma.order.findUnique({ where: { code }, select: { code: true } }) : null;
    if (order) redirect({ href: `/agent/s/${order.code}`, locale });
    notFound = true;
  }
  await expireOverdue();

  const [today, toPay, recent] = await Promise.all([
    cashSummary(user.id, startOfBrDay()),
    prisma.order.findMany({
      where: { channel: "AGENT", status: { in: ["WON", "VOID"] } },
      orderBy: { settledAt: "asc" },
      take: 20,
      omit: { receipt: true },
    }),
    prisma.order.findMany({
      where: { soldById: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      omit: { receipt: true },
    }),
  ]);

  const kpis = [
    { label: t("kpi.sales", { count: today.sales }), value: today.sold },
    { label: t("kpi.payouts", { count: today.payouts }), value: today.paid },
    { label: t("kpi.balance"), value: today.balance, strong: true },
  ];

  return (
    <div className="space-y-6">
      <section className="card space-y-3 p-5">
        <h1 className="font-display text-2xl font-bold">{t("finaliseTitle")}</h1>
        <p className="text-sm text-muted">{t("finaliseBody")}</p>
        <form className="flex gap-2" action="">
          <input
            name="code"
            defaultValue={raw}
            placeholder="PJ7K3M9Q"
            aria-label={t("code")}
            className="input text-center font-mono text-lg font-bold tracking-widest uppercase"
            maxLength={12}
            autoCapitalize="characters"
            autoFocus
            required
          />
          <button className="btn-primary px-5">{t("open")}</button>
        </form>
        {notFound && <p className="text-sm text-danger">{t("notFound")}</p>}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/sports" className="card p-5 text-center transition hover:border-brand">
          <span className="text-2xl">⚽</span>
          <p className="mt-1 font-display font-bold">{t("nav.sellSports")}</p>
        </Link>
        <Link href="/lottery" className="card p-5 text-center transition hover:border-gold">
          <span className="text-2xl">🎟️</span>
          <p className="mt-1 font-display font-bold">{t("nav.sellLottery")}</p>
        </Link>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("today")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {kpis.map((k) => (
            <div key={k.label} className="card p-4">
              <p className="text-xs text-muted">{k.label}</p>
              <p className={`mt-1 font-display text-2xl font-bold tabular-nums ${k.strong ? "text-brand-strong" : ""}`}>
                {formatMoney(k.value, locale)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("toPay")}</h2>
        <OrderList orders={toPay} locale={locale} empty={t("toPayEmpty")} payout />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("mySales")}</h2>
        <OrderList orders={recent} locale={locale} empty={t("noSales")} />
      </section>
    </div>
  );
}

type Row = {
  id: string;
  code: string;
  customerName: string;
  status: string;
  amount: Decimal;
  payout: Decimal | null;
  createdAt: Date;
};

function OrderList({
  orders,
  locale,
  empty,
  payout,
}: {
  orders: Row[];
  locale: string;
  empty: string;
  payout?: boolean;
}) {
  return (
    <div className="card divide-y divide-line text-sm">
      {orders.map((o) => (
        <Link key={o.id} href={`/agent/s/${o.code}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
          <span className="font-mono font-bold">{o.code}</span>
          <span className="min-w-0 flex-1 truncate">
            {o.customerName}
            <span className="block text-xs text-muted">
              <LocalTime value={o.createdAt} />
            </span>
          </span>
          <OrderStatusChip status={o.status} />
          <span className="w-24 text-right font-bold tabular-nums">
            {formatMoney(payout ? (o.payout ?? 0) : o.amount, locale)}
          </span>
        </Link>
      ))}
      {orders.length === 0 && <p className="p-5 text-muted">{empty}</p>}
    </div>
  );
}
