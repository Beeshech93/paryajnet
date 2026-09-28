import { getLocale, getTranslations } from "next-intl/server";
import {
  confirmOrderAction,
  markPaidAction,
  rejectOrderAction,
  resendPaymentInfoAction,
  setPayoutKeyAction,
} from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { LocalTime } from "@/components/LocalTime";
import { OrderDetails } from "@/components/orders/OrderDetails";
import { OrderStatusChip } from "@/components/orders/OrderStatusChip";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getOrderByCode, paidInTime } from "@/lib/orders";
import { formatPhone } from "@/lib/orders-rules";
import { formatPixKey, PIX_KEY_TYPES } from "@/lib/pix";

export default async function AdminOrder({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [locale, t, to] = await Promise.all([getLocale(), getTranslations("admin.orders"), getTranslations("orders")]);
  const order = await getOrderByCode(code);
  if (!order) return <p className="card p-6">{to("notFound")}</p>;
  const messages = await prisma.whatsAppMessage.findMany({
    where: { phone: order.phone, status: { not: "DEDUP" } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const open = order.status === "AWAITING_PAYMENT" || order.status === "RECEIPT_RECEIVED";
  const payable = order.status === "WON" || order.status === "VOID";
  const onTime = paidInTime(order);
  const receiptLate = order.receiptAt ? order.receiptAt > order.payBy : false;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-5">
        <section className="card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin/orders" className="text-sm text-muted">
              ←
            </Link>
            <h1 className="font-mono text-2xl font-black tracking-widest">{order.code}</h1>
            <OrderStatusChip status={order.status} />
            <span className="ml-auto text-xs text-muted">
              {t(`kinds.${order.kind}`)} · <LocalTime value={order.createdAt} />
            </span>
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="label">{t("customer")}</p>
              <p className="font-semibold">{order.customerName}</p>
              <a
                href={`https://wa.me/${order.phone}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-brand-strong"
              >
                {formatPhone(order.phone)}
              </a>
            </div>
            <div>
              <p className="label">{to("amount")}</p>
              <p className="font-display text-xl font-bold tabular-nums">{formatMoney(order.amount, locale)}</p>
            </div>
            <div>
              <p className="label">{order.payout ? to("payout") : to("potential")}</p>
              <p className="font-display text-xl font-bold text-brand-strong tabular-nums">
                {formatMoney(order.payout ?? order.potentialWin, locale)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            {t("payBy")} <LocalTime value={order.payBy} />
            {order.confirmedAt && (
              <>
                {" "}
                · {t("confirmedAt")} <LocalTime value={order.confirmedAt} />
              </>
            )}
            {order.paidAt && (
              <>
                {" "}
                · {t("paidAt")} <LocalTime value={order.paidAt} />
              </>
            )}
          </p>
          {order.adminNote && <p className="mt-2 rounded-lg bg-surface-2 p-2 text-xs">{order.adminNote}</p>}
        </section>

        <section className="card p-5 text-sm">
          <OrderDetails order={order} />
        </section>

        {open && (
          <section className="card space-y-4 p-5">
            <h2 className="font-display text-lg font-bold">{t("paymentTitle")}</h2>
            {order.receiptMime ? (
              <div className="space-y-2">
                <p className="text-xs text-muted">
                  {t("receiptAt")} <LocalTime value={order.receiptAt!} />{" "}
                  {receiptLate ? (
                    <span className="text-danger">· {t("late")}</span>
                  ) : (
                    <span className="text-brand-strong">· {t("onTime")}</span>
                  )}
                </p>
                {order.receiptMime.startsWith("image/") ? (
                  <a href={`/api/orders/${order.id}/receipt`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/orders/${order.id}/receipt`}
                      alt={t("receipt")}
                      className="max-h-[28rem] max-w-full rounded-xl border border-line"
                    />
                  </a>
                ) : (
                  <a href={`/api/orders/${order.id}/receipt`} target="_blank" rel="noreferrer" className="btn-ghost">
                    📄 {t("receipt")} (PDF)
                  </a>
                )}
              </div>
            ) : (
              <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">{t("noReceipt")}</p>
            )}
            {!onTime && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{t("tooLate")}</p>}
            <p className="text-xs text-muted">
              {t("confirmHelp", { amount: formatMoney(order.amount, locale), code: order.code })}
            </p>
            <ActionForm action={confirmOrderAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="orderId" value={order.id} />
              <div className="min-w-48 flex-1">
                <label className="label" htmlFor="c-note">
                  {t("note")}
                </label>
                <input
                  id="c-note"
                  name="note"
                  maxLength={300}
                  className="input"
                  placeholder={t("confirmNotePlaceholder")}
                />
              </div>
              <SubmitButton>✓ {t("confirm")}</SubmitButton>
            </ActionForm>
            <ActionForm action={rejectOrderAction} className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
              <input type="hidden" name="orderId" value={order.id} />
              <div className="min-w-48 flex-1">
                <label className="label" htmlFor="r-note">
                  {t("rejectReason")}
                </label>
                <input
                  id="r-note"
                  name="note"
                  required
                  maxLength={300}
                  className="input"
                  placeholder={t("rejectPlaceholder")}
                />
              </div>
              <SubmitButton className="btn-danger">{t("reject")}</SubmitButton>
            </ActionForm>
            <ActionForm action={resendPaymentInfoAction} success={t("resent")}>
              <input type="hidden" name="orderId" value={order.id} />
              <SubmitButton className="btn-ghost py-1.5 text-xs">↻ {t("resend")}</SubmitButton>
            </ActionForm>
          </section>
        )}

        {payable && (
          <section className="card space-y-4 border-gold p-5">
            <h2 className="font-display text-lg font-bold">
              {order.status === "WON" ? t("payWinner") : t("payRefund")} · {formatMoney(order.payout ?? 0, locale)}
            </h2>
            {order.payoutKey ? (
              <div className="rounded-xl bg-surface-2 p-4">
                <p className="label">
                  {t("payoutKey")} · {order.payoutKeyType}
                </p>
                <p className="font-mono text-lg font-bold break-all select-all">
                  {formatPixKey(order.payoutKeyType ?? "", order.payoutKey)}
                </p>
              </div>
            ) : (
              <p className="rounded-xl bg-gold/10 p-3 text-sm">{t("waitingKey")}</p>
            )}
            <ActionForm
              action={setPayoutKeyAction}
              success={t("keySaved")}
              className="grid gap-2 sm:grid-cols-[130px_1fr_auto] sm:items-end"
            >
              <input type="hidden" name="orderId" value={order.id} />
              <div>
                <label className="label" htmlFor="k-type">
                  {t("keyType")}
                </label>
                <select id="k-type" name="keyType" defaultValue={order.payoutKeyType ?? "CPF"} className="input">
                  {PIX_KEY_TYPES.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="k-key">
                  {order.payoutKey ? t("changeKey") : t("enterKey")}
                </label>
                <input id="k-key" name="key" required className="input font-mono" />
              </div>
              <SubmitButton className="btn-ghost">{t("saveKey")}</SubmitButton>
            </ActionForm>
            {order.payoutKey && (
              <ActionForm action={markPaidAction} className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
                <input type="hidden" name="orderId" value={order.id} />
                <div className="min-w-48 flex-1">
                  <label className="label" htmlFor="p-note">
                    {t("note")}
                  </label>
                  <input
                    id="p-note"
                    name="note"
                    maxLength={300}
                    className="input"
                    placeholder={t("paidNotePlaceholder")}
                  />
                </div>
                <SubmitButton className="btn-gold">💸 {t("markPaid")}</SubmitButton>
              </ActionForm>
            )}
          </section>
        )}
      </div>

      <aside className="card h-fit min-w-0 p-4">
        <h2 className="mb-3 font-display text-lg font-bold">WhatsApp</h2>
        <ul className="space-y-2 text-sm">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`rounded-xl p-2.5 ${m.direction === "IN" ? "mr-6 bg-surface-2" : "ml-6 bg-brand/15"}`}
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className="mt-1 text-[10px] text-muted">
                <LocalTime value={m.createdAt} /> · {m.status}
                {m.error && <span className="text-danger"> · {m.error.slice(0, 80)}</span>}
              </p>
            </li>
          ))}
          {messages.length === 0 && <p className="text-muted">—</p>}
        </ul>
      </aside>
    </div>
  );
}
