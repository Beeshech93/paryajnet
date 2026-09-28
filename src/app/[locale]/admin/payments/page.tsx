import { getLocale, getTranslations } from "next-intl/server";
import { paymentDecisionAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { LocalTime } from "@/components/LocalTime";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatPixKey } from "@/lib/pix";

export default async function AdminPayments() {
  const [locale, t, tw] = await Promise.all([getLocale(), getTranslations("admin"), getTranslations("wallet")]);
  const [pending, recent] = await Promise.all([
    prisma.payment.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      omit: { receipt: true },
      include: {
        user: { include: { kycSubmissions: { where: { status: "VERIFIED" }, take: 1 } } },
        wallet: true,
      },
    }),
    prisma.payment.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { updatedAt: "desc" },
      take: 25,
      omit: { receipt: true },
      include: { user: true, wallet: true },
    }),
  ]);
  const deposits = pending.filter((p) => p.kind === "DEPOSIT");
  const withdrawals = pending.filter((p) => p.kind === "WITHDRAWAL");
  type Row = (typeof pending)[number];

  const Decision = ({ p, approveLabel }: { p: Row; approveLabel: string }) => (
    <ActionForm action={paymentDecisionAction} className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
      <input type="hidden" name="paymentId" value={p.id} />
      <div className="min-w-48 flex-1">
        <label className="label" htmlFor={`n-${p.id}`}>
          {t("payments.noteLabel")}
        </label>
        <input
          id={`n-${p.id}`}
          name="note"
          maxLength={300}
          className="input"
          placeholder={t("payments.notePlaceholder")}
        />
      </div>
      <button name="decision" value="approve" className="btn-primary">
        ✓ {approveLabel}
      </button>
      <button name="decision" value="reject" className="btn-danger">
        {t("payments.reject")}
      </button>
    </ActionForm>
  );

  const Head = ({ p }: { p: Row }) => (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {p.user.kycSubmissions[0]?.fullName ?? p.user.name}{" "}
          <span className="font-normal text-muted">· {p.user.email}</span>
          {p.user.kycStatus === "VERIFIED" && <span className="chip ml-2 bg-brand/15 text-brand-strong">KYC ✓</span>}
        </p>
        <p className="text-xs text-muted">
          {p.method} · <span className="font-mono">#{p.reference ?? p.providerRef}</span> ·{" "}
          <LocalTime value={p.createdAt} />
        </p>
      </div>
      <span className="font-display text-xl font-bold tabular-nums">
        {formatMoney(p.amount, p.wallet.currency, locale)}
      </span>
    </div>
  );

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-1 font-display text-lg font-bold">
          {t("payments.depositsTitle", { count: deposits.length })}
        </h2>
        <p className="mb-3 text-xs text-muted">{t("payments.depositsHelp")}</p>
        <div className="space-y-3">
          {deposits.map((p) => (
            <article key={p.id} className="card space-y-3 p-4 text-sm">
              <Head p={p} />
              {p.payerNote || p.receiptMime ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 p-3">
                  {p.payerNote && <p className="flex-1">“{p.payerNote}”</p>}
                  {p.receiptMime && (
                    <a
                      href={`/api/payments/${p.id}/receipt`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost py-1.5"
                    >
                      📎 {t("payments.viewReceipt")}
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted">{t("payments.noReceipt")}</p>
              )}
              <Decision p={p} approveLabel={t("payments.confirmDeposit")} />
            </article>
          ))}
          {deposits.length === 0 && <p className="card p-5 text-sm text-muted">{t("empty")}</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-display text-lg font-bold">
          {t("payments.withdrawalsTitle", { count: withdrawals.length })}
        </h2>
        <p className="mb-3 text-xs text-muted">{t("payments.withdrawalsHelp")}</p>
        <div className="space-y-3">
          {withdrawals.map((p) => {
            const info = p.instructions ? (JSON.parse(p.instructions) as Record<string, string>) : {};
            return (
              <article key={p.id} className="card space-y-3 p-4 text-sm">
                <Head p={p} />
                <div className="grid gap-2 rounded-xl bg-surface-2 p-3 sm:grid-cols-3">
                  <div>
                    <p className="label">{info.pixKey ? tw("pixKeyType") : tw("fields.clabe")}</p>
                    <p className="font-semibold">{info.pixKey ? tw(`pixTypes.${info.pixKeyType}`) : "SPEI"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="label">{info.pixKey ? tw("fields.pixKey") : tw("fields.clabe")}</p>
                    <p className="font-mono text-base font-bold break-all select-all">
                      {info.pixKey ? formatPixKey(info.pixKeyType, info.pixKey) : info.clabe}
                    </p>
                  </div>
                </div>
                <Decision p={p} approveLabel={t("payments.markPaid")} />
              </article>
            );
          })}
          {withdrawals.length === 0 && <p className="card p-5 text-sm text-muted">{t("empty")}</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("payments.recent")}</h2>
        <div className="card divide-y divide-line text-sm">
          {recent.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
              <span className="w-24 text-xs text-muted">{tw(`kind.${p.kind}`)}</span>
              <span className="min-w-0 flex-1 truncate">
                {p.user.email}
                {p.adminNote && <span className="text-xs text-muted"> · {p.adminNote}</span>}
              </span>
              <span className="text-xs">{tw(`status.${p.status}`)}</span>
              <span className="w-32 text-right tabular-nums">{formatMoney(p.amount, p.wallet.currency, locale)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
