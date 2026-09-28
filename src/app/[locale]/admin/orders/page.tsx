import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { LocalTime } from "@/components/LocalTime";
import { OrderStatusChip } from "@/components/orders/OrderStatusChip";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { expireOverdue } from "@/lib/orders";
import { findOrderCode, formatPhone } from "@/lib/orders-rules";

const FILTERS: Record<string, string[] | null> = {
  RECEIPT_RECEIVED: ["RECEIPT_RECEIVED"],
  PAYOUT: ["WON", "VOID"],
  AWAITING_PAYMENT: ["AWAITING_PAYMENT"],
  CONFIRMED: ["CONFIRMED"],
  DONE: ["PAID", "LOST"],
  CLOSED: ["REJECTED", "EXPIRED"],
  ALL: null,
};

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("admin.orders")]);
  const { status = "RECEIPT_RECEIVED", q } = await searchParams;
  await expireOverdue();

  // "Finalise with the generated number": searching an exact code opens the service.
  if (q) {
    const code = findOrderCode(q) ?? q.trim().toUpperCase();
    const exact = await prisma.order.findUnique({ where: { code }, select: { code: true } });
    if (exact) redirect({ href: `/admin/orders/${exact.code}`, locale });
  }

  const filter = FILTERS[status] ?? null;
  const digits = q?.replace(/\D/g, "");
  const orders = await prisma.order.findMany({
    where: {
      ...(filter && !q ? { status: { in: filter } } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q.trim().toUpperCase() } },
              ...(digits && digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
              { customerName: { contains: q.trim() } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: status === "RECEIPT_RECEIVED" || status === "PAYOUT" ? "asc" : "desc" },
    take: 100,
    omit: { receipt: true },
    include: { soldBy: { select: { name: true } } },
  });
  const counts = await prisma.order.groupBy({ by: ["status"], _count: { _all: true } });
  const countOf = (keys: string[] | null) =>
    counts.filter((c) => !keys || keys.includes(c.status)).reduce((a, c) => a + c._count._all, 0);

  return (
    <div className="space-y-5">
      <form className="flex gap-2" action="">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("searchPlaceholder")}
          className="input font-mono uppercase"
          autoFocus
        />
        <button className="btn-primary px-5">{t("search")}</button>
      </form>

      <div className="flex flex-wrap gap-2">
        {Object.entries(FILTERS).map(([key, keys]) => (
          <Link
            key={key}
            href={{ pathname: "/admin/orders", query: { status: key } }}
            className={`chip border px-3 py-1.5 ${key === status && !q ? "border-brand bg-brand text-brand-ink" : "border-line text-muted"}`}
          >
            {t(`filters.${key}`)} · {countOf(keys)}
          </Link>
        ))}
      </div>

      <div className="card divide-y divide-line text-sm">
        {orders.map((o) => {
          const late = o.status === "RECEIPT_RECEIVED" && o.receiptAt && o.receiptAt > o.payBy;
          return (
            <Link
              key={o.id}
              href={`/admin/orders/${o.code}`}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2 md:flex"
            >
              <span className="font-mono font-bold md:w-28">{o.code}</span>
              <span className="col-span-2 min-w-0 md:order-none md:flex-1">
                <span className="font-semibold">{o.customerName}</span>
                <span className="block text-xs text-muted">
                  {o.channel === "AGENT" ? `💵 ${o.soldBy?.name ?? "—"}` : formatPhone(o.phone)} ·{" "}
                  {t(`kinds.${o.kind}`)} · <LocalTime value={o.createdAt} />
                </span>
              </span>
              {late && <span className="chip bg-danger/15 text-danger">{t("late")}</span>}
              <OrderStatusChip status={o.status} />
              <span className="w-28 text-right font-bold tabular-nums">
                {formatMoney(o.status === "WON" || o.status === "VOID" ? (o.payout ?? 0) : o.amount, locale)}
              </span>
            </Link>
          );
        })}
        {orders.length === 0 && <p className="p-5 text-muted">{t("empty")}</p>}
      </div>
    </div>
  );
}
