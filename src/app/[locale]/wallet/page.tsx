import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocalTime } from "@/components/LocalTime";
import { DepositInstructions } from "@/components/wallet/DepositInstructions";
import { DepositForm, SimulateButton, WithdrawForm } from "@/components/wallet/WalletForms";
import { availableDepositMethods } from "@/lib/payment-providers";
import { withdrawalsRequireKyc } from "@/lib/payments";
import { formatPixKey } from "@/lib/pix";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CURRENCY_LIMITS, formatMoney } from "@/lib/money";
import { getActiveCurrency, getOrCreateWallet } from "@/lib/wallet";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("wallet") };
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-gold/15 text-gold-strong",
  COMPLETED: "bg-brand/15 text-brand-strong",
  REJECTED: "bg-danger/15 text-danger",
};

export default async function WalletPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const user = await requireUser();
  const [locale, t] = await Promise.all([getLocale(), getTranslations("wallet")]);
  const currency = await getActiveCurrency(user, locale);
  const wallet = await getOrCreateWallet(user.id, currency);
  const limits = CURRENCY_LIMITS[currency];
  const [wallets, payments, transactions, depositMethods] = await Promise.all([
    prisma.wallet.findMany({ where: { userId: user.id }, orderBy: { currency: "asc" } }),
    prisma.payment.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      omit: { receipt: true },
    }),
    prisma.transaction.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: "desc" }, take: 25 }),
    availableDepositMethods(limits.depositMethods),
  ]);
  const canWithdraw = !withdrawalsRequireKyc() || user.kycStatus === "VERIFIED";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {wallets.map((w) => (
            <div key={w.id} className={`card p-5 ${w.currency === currency ? "border-brand/60" : ""}`}>
              <p className="text-xs font-bold text-muted">
                {w.currency}
                {w.currency === currency ? ` · ${t("active")}` : ""}
              </p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                {formatMoney(w.balance, w.currency, locale)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{t("switchHint")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-display text-lg font-bold">{t("deposit")}</h2>
          <p className="text-xs text-muted">
            {t("depositRange", {
              min: formatMoney(limits.minDeposit, currency, locale),
              max: formatMoney(limits.maxDeposit, currency, locale),
            })}
          </p>
          {depositMethods.length > 0 ? (
            <DepositForm methods={depositMethods} currency={currency} />
          ) : (
            <p className="mt-4 rounded-xl bg-surface-2 p-4 text-sm text-muted">{t("depositsUnavailable")}</p>
          )}
          <p className="mt-3 text-xs text-muted">{t("depositNote")}</p>
        </section>
        <section className="card p-5">
          <h2 className="font-display text-lg font-bold">{t("withdraw")}</h2>
          <p className="text-xs text-muted">
            {t("withdrawMin", { min: formatMoney(limits.minWithdrawal, currency, locale) })}
          </p>
          {canWithdraw ? (
            <WithdrawForm methods={limits.withdrawalMethods} currency={currency} />
          ) : (
            <div className="mt-4 rounded-xl bg-gold/10 p-4 text-sm">
              <p>{t("kycNeeded")}</p>
              <Link href="/account#kyc" className="btn-primary mt-3">
                {t("verifyNow")}
              </Link>
            </div>
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("payments")}</h2>
        {payments.length === 0 ? (
          <p className="card p-5 text-sm text-muted">{t("noPayments")}</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => {
              const info = p.instructions ? (JSON.parse(p.instructions) as Record<string, string>) : {};
              return (
                <div key={p.id} className="card p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold">
                      {t(`kind.${p.kind}`)} · {p.method}
                    </span>
                    <span className={`chip ${STATUS_STYLE[p.status]}`}>{t(`status.${p.status}`)}</span>
                    <span className="text-xs text-muted">
                      <LocalTime value={p.createdAt} />
                    </span>
                    <span className="ml-auto font-bold tabular-nums">{formatMoney(p.amount, currency, locale)}</span>
                  </div>
                  {p.reference && <p className="mt-1 font-mono text-xs text-muted">#{p.reference}</p>}
                  {p.kind === "DEPOSIT" && p.status === "PENDING" && (
                    <>
                      <DepositInstructions
                        paymentId={p.id}
                        method={p.method}
                        amount={formatMoney(p.amount, currency, locale)}
                        info={info}
                        receiptSent={!!p.receiptMime || !!p.payerNote}
                        payerNote={p.payerNote}
                      />
                      {p.provider === "mock" && process.env.NODE_ENV !== "production" && (
                        <SimulateButton paymentId={p.id} />
                      )}
                    </>
                  )}
                  {p.kind === "WITHDRAWAL" && p.status === "PENDING" && (
                    <p className="mt-2 text-xs text-muted">
                      {t("withdrawPending", {
                        destination: info.pixKey ? formatPixKey(info.pixKeyType, info.pixKey) : (info.clabe ?? ""),
                      })}
                    </p>
                  )}
                  {p.status === "REJECTED" && p.adminNote && (
                    <p className="mt-2 rounded-lg bg-danger/10 p-2 text-xs text-danger">{p.adminNote}</p>
                  )}
                  {p.status === "COMPLETED" && p.kind === "WITHDRAWAL" && p.adminNote && (
                    <p className="mt-2 text-xs text-muted">{p.adminNote}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("history")}</h2>
        <div className="card divide-y divide-line text-sm">
          {transactions.length === 0 && <p className="p-5 text-muted">{t("noTransactions")}</p>}
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-28 text-xs text-muted">
                <LocalTime value={tx.createdAt} />
              </span>
              <span className="flex-1">{t(`txType.${tx.type}`)}</span>
              <span
                className={`font-semibold tabular-nums ${tx.amount.isNegative() ? "text-ink" : "text-brand-strong"}`}
              >
                {tx.amount.isNegative() ? "" : "+"}
                {formatMoney(tx.amount, currency, locale)}
              </span>
              <span className="hidden w-28 text-right text-xs text-muted tabular-nums sm:block">
                {formatMoney(tx.balanceAfter, currency, locale)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
