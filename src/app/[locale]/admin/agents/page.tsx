import { getLocale, getTranslations } from "next-intl/server";
import { createAgentAction, resetAgentPasswordAction, toggleAgentAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { cashSummary, startOfBrDay } from "@/lib/sales";

export const dynamic = "force-dynamic";

/** Sales agents (vendedores): accounts and the cash each one should hand in. */
export default async function AdminAgents() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("admin.agents")]);
  const agents = await prisma.user.findMany({ where: { role: "AGENT" }, orderBy: { createdAt: "asc" } });
  const today = startOfBrDay();
  const [rows, allToday, allTime] = await Promise.all([
    Promise.all(
      agents.map(async (a) => ({ agent: a, today: await cashSummary(a.id, today), total: await cashSummary(a.id) })),
    ),
    cashSummary(null, today),
    cashSummary(null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: t("soldToday", { count: allToday.sales }), value: allToday.sold },
          { label: t("paidToday", { count: allToday.payouts }), value: allToday.paid },
          { label: t("balanceTotal"), value: allTime.balance },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-xs text-muted">{k.label}</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">{formatMoney(k.value, locale)}</p>
          </div>
        ))}
      </div>

      <div className="card divide-y divide-line text-sm">
        {rows.map(({ agent, today, total }) => (
          <div key={agent.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <p className="font-semibold">
                {agent.name}{" "}
                {!agent.active && <span className="chip ml-1 bg-danger/15 text-danger">{t("inactive")}</span>}
              </p>
              <p className="truncate text-xs text-muted">{agent.email}</p>
              <p className="mt-2 text-xs">
                {t("today")}: {t("sales", { count: today.sales })} {formatMoney(today.sold, locale)} ·{" "}
                {t("payouts", { count: today.payouts })} {formatMoney(today.paid, locale)} ·{" "}
                <b>
                  {t("balance")} {formatMoney(today.balance, locale)}
                </b>
              </p>
              <p className="text-xs text-muted">
                {t("total")}: {formatMoney(total.sold, locale)} − {formatMoney(total.paid, locale)} ={" "}
                {formatMoney(total.balance, locale)}
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <ActionForm action={resetAgentPasswordAction} success={t("passwordSaved")} className="flex gap-2">
                <input type="hidden" name="id" value={agent.id} />
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                  placeholder={t("newPassword")}
                  aria-label={t("newPassword")}
                  className="input w-40 py-1.5"
                />
                <SubmitButton className="btn-ghost py-1.5 text-xs">{t("setPassword")}</SubmitButton>
              </ActionForm>
              <ActionForm action={toggleAgentAction}>
                <input type="hidden" name="id" value={agent.id} />
                <SubmitButton className={`${agent.active ? "btn-danger" : "btn-primary"} py-1.5 text-xs`}>
                  {agent.active ? t("deactivate") : t("activate")}
                </SubmitButton>
              </ActionForm>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="p-5 text-muted">{t("empty")}</p>}
      </div>

      <section className="card p-5">
        <h2 className="font-display text-lg font-bold">{t("newAgent")}</h2>
        <ActionForm
          action={createAgentAction}
          success={t("created")}
          className="mt-3 grid gap-3 sm:grid-cols-4 sm:items-end"
        >
          <div>
            <label className="label" htmlFor="ag-name">
              {t("name")}
            </label>
            <input id="ag-name" name="name" required minLength={2} maxLength={80} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="ag-email">
              {t("email")}
            </label>
            <input id="ag-email" name="email" type="email" required autoComplete="off" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="ag-password">
              {t("password")}
            </label>
            <input
              id="ag-password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="input"
            />
          </div>
          <SubmitButton>{t("create")}</SubmitButton>
        </ActionForm>
        <p className="mt-3 text-xs text-muted">{t("help")}</p>
      </section>
    </div>
  );
}
