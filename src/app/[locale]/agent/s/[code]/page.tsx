import { getLocale, getTranslations } from "next-intl/server";
import { cancelSaleAction, payOutCashAction } from "@/app/actions/orders";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PrintButton } from "@/components/agent/PrintButton";
import { LocalTime } from "@/components/LocalTime";
import { OrderDetails } from "@/components/orders/OrderDetails";
import { OrderStatusChip } from "@/components/orders/OrderStatusChip";
import { Link } from "@/i18n/navigation";
import { requireSeller } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getOrderByCode } from "@/lib/orders";
import { CANCEL_WINDOW_MINUTES, cancellable, formatPhone } from "@/lib/orders-rules";

export const dynamic = "force-dynamic";

/** A service seen by a sales agent: printable ticket, cash payout (finalise) and cancel. */
export default async function AgentTicket({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [user, locale, t, to] = await Promise.all([
    requireSeller(),
    getLocale(),
    getTranslations("sale"),
    getTranslations("orders"),
  ]);
  const order = await getOrderByCode(code);
  if (!order) {
    return (
      <div className="card space-y-3 p-6">
        <p>{to("notFound")}</p>
        <Link href="/agent" className="btn-ghost">
          ← {t("nav.panel")}
        </Link>
      </div>
    );
  }
  const people = await prisma.user.findMany({
    where: { id: { in: [order.soldById, order.paidById].filter((x): x is string => Boolean(x)) } },
    select: { id: true, name: true },
  });
  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.name ?? "—";
  const cash = order.channel === "AGENT";
  const payable = order.status === "WON" || order.status === "VOID";
  const canCancel = cancellable(order, user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/agent" className="text-sm text-muted print:hidden">
        ← {t("nav.panel")}
      </Link>

      <section className="card overflow-hidden print:border-0 print:shadow-none">
        <div className="bg-gradient-to-br from-[#0a2f5c] via-[#0b5ea8] to-[#0ea5e9] p-6 text-white print:bg-none print:p-2 print:text-black">
          <p className="text-xs font-semibold tracking-wide uppercase opacity-70">ParyajNet · {to("service")}</p>
          <p className="mt-1 font-mono text-4xl font-black tracking-widest">{order.code}</p>
          <p className="mt-2 text-sm opacity-80">
            {order.customerName}
            {order.phone && <> · {formatPhone(order.phone)}</>}
          </p>
        </div>
        <div className="space-y-4 p-5 print:p-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <OrderStatusChip status={order.status} />
            <span className="chip bg-surface-2 text-muted">
              {cash ? `💵 ${t("channel.AGENT")}` : t("channel.ONLINE")}
            </span>
            <span className="text-xs text-muted">
              <LocalTime value={order.createdAt} />
              {cash && <> · {t("soldBy", { name: nameOf(order.soldById) })}</>}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="label">{t("paid")}</p>
              <p className="font-display text-xl font-bold tabular-nums">{formatMoney(order.amount, locale)}</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="label">{order.payout ? to("payout") : to("potential")}</p>
              <p className="font-display text-xl font-bold text-brand-strong tabular-nums">
                {formatMoney(order.payout ?? order.potentialWin, locale)}
              </p>
            </div>
          </div>
          <OrderDetails order={order} />
          <p className="hidden text-center text-xs print:block">{t("ticketFooter", { code: order.code })}</p>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 print:hidden">
        <PrintButton label={t("print")} />
        {order.phone && (
          <a
            href={`https://wa.me/${order.phone}?text=${encodeURIComponent(t("shareText", { code: order.code }))}`}
            target="_blank"
            rel="noreferrer"
            className="btn bg-[#25D366] text-[#062a1a] hover:brightness-110"
          >
            WhatsApp
          </a>
        )}
      </div>

      {payable && cash && (
        <section className="card space-y-3 border-gold p-5 print:hidden">
          <h2 className="font-display text-lg font-bold">
            {order.status === "WON" ? t("payWinner") : t("payRefund")} ·{" "}
            <span className="text-brand-strong">{formatMoney(order.payout ?? 0, locale)}</span>
          </h2>
          <p className="text-sm text-muted">{t("payHelp", { code: order.code })}</p>
          <ActionForm action={payOutCashAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="orderId" value={order.id} />
            <div className="min-w-48 flex-1">
              <label className="label" htmlFor="p-note">
                {t("note")}
              </label>
              <input id="p-note" name="note" maxLength={300} className="input" placeholder={t("notePlaceholder")} />
            </div>
            <SubmitButton className="btn-gold">
              💵 {t("payAndFinalise", { amount: formatMoney(order.payout ?? 0, locale) })}
            </SubmitButton>
          </ActionForm>
        </section>
      )}
      {payable && !cash && (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted print:hidden">{t("onlinePix")}</p>
      )}
      {order.status === "PAID" && order.paidAt && (
        <p className="rounded-xl bg-brand/10 p-4 text-sm print:hidden">
          ✅ {t("finalised")} <LocalTime value={order.paidAt} />
          {order.payoutKeyType === "CASH" && <> · {t("paidBy", { name: nameOf(order.paidById) })}</>}
        </p>
      )}
      {order.status === "CONFIRMED" && (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted print:hidden">{t("waitingResult")}</p>
      )}
      {canCancel && (
        <ActionForm action={cancelSaleAction} className="print:hidden">
          <input type="hidden" name="orderId" value={order.id} />
          <p className="mb-2 text-xs text-muted">{t("cancelHelp", { minutes: CANCEL_WINDOW_MINUTES })}</p>
          <SubmitButton className="btn-danger">{t("cancel")}</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
