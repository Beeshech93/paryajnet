import { getLocale, getTranslations } from "next-intl/server";
import { paymentDecisionAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { LocalTime } from "@/components/LocalTime";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export default async function AdminPayments() {
  const [locale, t, tw] = await Promise.all([getLocale(), getTranslations("admin"), getTranslations("wallet")]);
  const [pending, recent] = await Promise.all([
    prisma.payment.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { user: true, wallet: true },
    }),
    prisma.payment.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { user: true, wallet: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("payments.pending")}</h2>
        <div className="space-y-2">
          {pending.map((p) => {
            const info = p.instructions ? (JSON.parse(p.instructions) as Record<string, string>) : {};
            const dest = p.kind === "WITHDRAWAL" ? (info.pixKey ?? info.clabe) : p.providerRef;
            return (
              <div key={p.id} className="card flex flex-wrap items-center gap-3 p-4 text-sm">
                <span
                  className={`chip ${p.kind === "WITHDRAWAL" ? "bg-gold/15 text-gold-strong" : "bg-brand/15 text-brand-strong"}`}
                >
                  {tw(`kind.${p.kind}`)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {p.user.name} <span className="font-normal text-muted">· {p.user.email}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {p.method} · <span className="font-mono">{dest}</span> · <LocalTime value={p.createdAt} />
                  </p>
                </div>
                <span className="font-bold tabular-nums">{formatMoney(p.amount, p.wallet.currency, locale)}</span>
                <ActionForm action={paymentDecisionAction} className="flex gap-2">
                  <input type="hidden" name="paymentId" value={p.id} />
                  <button name="decision" value="approve" className="btn-primary py-1.5">
                    {t("payments.approve")}
                  </button>
                  <button name="decision" value="reject" className="btn-danger py-1.5">
                    {t("payments.reject")}
                  </button>
                </ActionForm>
              </div>
            );
          })}
          {pending.length === 0 && <p className="card p-5 text-sm text-muted">{t("empty")}</p>}
        </div>
        <p className="mt-2 text-xs text-muted">{t("payments.note")}</p>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("payments.recent")}</h2>
        <div className="card divide-y divide-line text-sm">
          {recent.map((p) => (
            <div key={p.id} className="flex flex-wrap gap-3 px-4 py-2">
              <span className="w-24 text-xs text-muted">{tw(`kind.${p.kind}`)}</span>
              <span className="flex-1">{p.user.email}</span>
              <span className="text-xs">{tw(`status.${p.status}`)}</span>
              <span className="w-32 text-right tabular-nums">{formatMoney(p.amount, p.wallet.currency, locale)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
