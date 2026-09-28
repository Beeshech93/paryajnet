import QRCode from "qrcode";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocalTime } from "@/components/LocalTime";
import { CodeLookup } from "@/components/orders/CodeLookup";
import { CopyField } from "@/components/orders/CopyField";
import { OrderDetails } from "@/components/orders/OrderDetails";
import { formatMoney } from "@/lib/money";
import { getOrderByCode } from "@/lib/orders";
import { maskPhone } from "@/lib/orders-rules";
import { formatPixKey, pixBrCode } from "@/lib/pix";
import { getPaymentSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const STEPS = ["AWAITING_PAYMENT", "RECEIPT_RECEIVED", "CONFIRMED", "RESULT", "PAID"] as const;

function stepIndex(status: string) {
  if (status === "AWAITING_PAYMENT") return 0;
  if (status === "RECEIPT_RECEIVED") return 1;
  if (status === "CONFIRMED") return 2;
  if (status === "WON" || status === "LOST" || status === "VOID") return status === "LOST" ? 4 : 3;
  if (status === "PAID") return 4;
  return -1; // REJECTED / EXPIRED
}

export default async function ServicePage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale: l, code } = await params;
  setRequestLocale(l);
  const [locale, t] = await Promise.all([getLocale(), getTranslations("orders")]);
  const order = await getOrderByCode(code);
  if (!order) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-6">
        <h1 className="font-display text-2xl font-bold">{t("notFound")}</h1>
        <CodeLookup initial={code} />
      </div>
    );
  }

  const settings = await getPaymentSettings();
  const awaiting = order.status === "AWAITING_PAYMENT" || order.status === "RECEIPT_RECEIVED";
  const pix =
    awaiting && settings["pix.key"] && settings["pix.name"]
      ? pixBrCode({
          key: settings["pix.key"],
          name: settings["pix.name"],
          city: settings["pix.city"] ?? "BRASIL",
          amount: order.amount.toFixed(2),
          txid: order.code,
        })
      : null;
  const qr = pix ? await QRCode.toString(pix, { type: "svg", margin: 1 }) : null;
  const current = stepIndex(order.status);
  const agentNumber = process.env.WHATSAPP_AGENT_NUMBER?.replace(/\D/g, "");
  const tone =
    order.status === "WON" || order.status === "PAID"
      ? "bg-brand/15 text-brand-strong"
      : order.status === "REJECTED" || order.status === "EXPIRED" || order.status === "LOST"
        ? "bg-danger/15 text-danger"
        : "bg-gold/15 text-gold-strong";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-br from-[#0a2f5c] via-[#0b5ea8] to-[#0ea5e9] p-6 text-white">
          <p className="text-xs font-semibold tracking-wide text-white/70 uppercase">{t("service")}</p>
          <p className="mt-1 font-mono text-3xl font-black tracking-widest">{order.code}</p>
          <p className="mt-2 text-sm text-white/80">
            {order.customerName.split(" ")[0]} · WhatsApp {maskPhone(order.phone)}
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`chip px-3 py-1 text-sm ${tone}`}>{t(`status.${order.status}`)}</span>
            <span className="text-sm text-muted">{t(`statusHelp.${order.status}`)}</span>
          </div>
          {current >= 0 && (
            <ol className="grid grid-cols-5 gap-1">
              {STEPS.map((s, i) => (
                <li key={s} className="space-y-1">
                  <div className={`h-1.5 rounded-full ${i <= current ? "bg-brand" : "bg-surface-2"}`} />
                  <p className={`text-[10px] leading-tight ${i <= current ? "text-ink" : "text-muted"}`}>
                    {t(`steps.${s}`)}
                  </p>
                </li>
              ))}
            </ol>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="label">{t("amount")}</p>
              <p className="font-display text-xl font-bold tabular-nums">{formatMoney(order.amount, locale)}</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="label">{order.payout ? t("payout") : t("potential")}</p>
              <p className="font-display text-xl font-bold text-brand-strong tabular-nums">
                {formatMoney(order.payout ?? order.potentialWin, locale)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {awaiting && (
        <section className="card space-y-4 p-5">
          <h2 className="font-display text-lg font-bold">{t("payTitle")}</h2>
          <p className="text-sm text-muted">
            {t("payBody", { amount: formatMoney(order.amount, locale) })}{" "}
            <b className="text-ink">
              <LocalTime value={order.payBy} />
            </b>
          </p>
          {pix ? (
            <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start">
              {qr && (
                <div
                  className="mx-auto w-44 rounded-xl bg-white p-2 sm:w-full [&_svg]:h-auto [&_svg]:w-full"
                  // QR generated server-side from our own PIX payload.
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
              )}
              <div className="min-w-0 space-y-3">
                <CopyField label={t("pixCode")} value={pix} />
                <CopyField
                  label={`${t("pixKey")} (${settings["pix.keyType"]})`}
                  value={formatPixKey(settings["pix.keyType"] ?? "", settings["pix.key"]!)}
                />
                <p className="text-xs text-muted">
                  {t("beneficiary")}: <b className="text-ink">{settings["pix.name"]}</b>
                  {settings["pix.bank"] && <> · {settings["pix.bank"]}</>}
                </p>
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-surface-2 p-3 text-sm">{t("payViaWhatsapp")}</p>
          )}
          <div className="rounded-xl bg-brand/10 p-4 text-sm">
            <p>{order.status === "RECEIPT_RECEIVED" ? t("receiptReceived") : t("sendReceipt")}</p>
            {agentNumber && (
              <a
                href={`https://wa.me/${agentNumber}?text=${encodeURIComponent(order.code)}`}
                target="_blank"
                rel="noreferrer"
                className="btn mt-3 bg-[#25D366] text-[#062a1a] hover:brightness-110"
              >
                WhatsApp · {order.code}
              </a>
            )}
          </div>
        </section>
      )}

      <section className="card space-y-3 p-5 text-sm">
        <h2 className="font-display text-lg font-bold">{t("details")}</h2>
        <OrderDetails order={order} />
      </section>

      <p className="text-center text-xs text-muted">
        <Link href="/s" className="underline">
          {t("lookupAnother")}
        </Link>
      </p>
    </div>
  );
}
