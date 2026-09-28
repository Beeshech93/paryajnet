import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocalTime } from "@/components/LocalTime";
import { DepositForm, SimulateButton, WithdrawForm } from "@/components/wallet/WalletForms";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CURRENCY_LIMITS, formatMoney } from "@/lib/money";
import { paymentsMode } from "@/lib/payments";
import { getActiveCurrency, getOrCreateWallet } from "@/lib/wallet";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("wallet") };
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-gold/15 text-gold",
  COMPLETED: "bg-brand/15 text-brand",
  REJECTED: "bg-danger/15 text-danger",
};

export default async function WalletPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const user = await requireUser();
  const [locale, t] = await Promise.all([getLocale(), getTranslations("wallet")]);
  const currency = await getActiveCurrency(user, locale);
  const wallet = await getOrCreateWallet(user.id, currency);
  const limits = CURRENCY_LIMITS[currency];
  const [wallets, payments, transactions] = await Promise.all([
    prisma.wallet.findMany({ where: { userId: user.id }, orderBy: { currency: "asc" } }),
    prisma.payment.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.transaction.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  const mock = paymentsMode() === "mock";

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
          <DepositForm methods={limits.depositMethods} currency={currency} />
        </section>
        <section className="card p-5">
          <h2 className="font-display text-lg font-bold">{t("withdraw")}</h2>
          <p className="text-xs text-muted">
            {t("withdrawMin", { min: formatMoney(limits.minWithdrawal, currency, locale) })}
          </p>
          {user.kycStatus === "VERIFIED" ? (
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
                  {p.kind === "DEPOSIT" && p.status === "PENDING" && (
                    <div className="mt-3 space-y-2 rounded-xl bg-surface-2 p-3">
                      <p className="text-xs text-muted">{t(`instructions.${p.method}`)}</p>
                      {Object.entries(info)
                        .filter(([k]) => k !== "expiresAt")
                        .map(([k, v]) => (
                          <div key={k}>
                            <p className="label">{t.has(`fields.${k}`) ? t(`fields.${k}`) : k}</p>
                            <p className="font-mono text-xs break-all select-all">{v}</p>
                          </div>
                        ))}
                      {mock && <SimulateButton paymentId={p.id} />}
                    </div>
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
              <span className={`font-semibold tabular-nums ${tx.amount.isNegative() ? "text-ink" : "text-brand"}`}>
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
