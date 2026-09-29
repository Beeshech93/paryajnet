import { getLocale, getTranslations } from "next-intl/server";
import {
  approveAccountAction,
  createAgentAction,
  rejectAccountAction,
  resetAgentPasswordAction,
  toggleAgentAction,
} from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { LocalTime } from "@/components/LocalTime";
import { ResetLinkButton } from "@/components/admin/ResetLinkButton";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mailConfigured } from "@/lib/mailer";
import { formatMoney } from "@/lib/money";
import { cashSummary, startOfBrDay } from "@/lib/sales";

export const dynamic = "force-dynamic";

/** Back-office users: sales agents (vendedores) and admins, with the cash each one should hand in. */
export default async function AdminAgents() {
  const [locale, t, me] = await Promise.all([getLocale(), getTranslations("admin.agents"), getCurrentUser()]);
  const [agents, pending] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["AGENT", "ADMIN"] }, pendingApproval: false },
      orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    }),
    prisma.user.findMany({ where: { pendingApproval: true }, orderBy: { createdAt: "asc" } }),
  ]);
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

      {pending.length > 0 && (
        <section className="card border-gold p-5">
          <h2 className="font-display text-lg font-bold">
            {t("pendingTitle")} · {pending.length}
          </h2>
          <p className="mt-1 text-xs text-muted">{t("pendingHelp")}</p>
          <ul className="mt-3 divide-y divide-line text-sm">
            {pending.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{u.name}</p>
                  <p className="truncate text-xs text-muted">
                    {u.email} · <LocalTime value={u.createdAt} />
                  </p>
                </div>
                <ActionForm action={approveAccountAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  <select name="role" defaultValue="AGENT" aria-label={t("role")} className="input w-auto py-1.5">
                    <option value="AGENT">{t("roles.AGENT")}</option>
                    <option value="ADMIN">{t("roles.ADMIN")}</option>
                  </select>
                  <SubmitButton className="btn-primary py-1.5 text-xs">✓ {t("approve")}</SubmitButton>
                </ActionForm>
                <ActionForm action={rejectAccountAction}>
                  <input type="hidden" name="id" value={u.id} />
                  <SubmitButton className="btn-danger py-1.5 text-xs">{t("rejectRequest")}</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}

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
                <span
                  className={`chip ml-1 ${agent.role === "ADMIN" ? "bg-danger/15 text-danger" : "bg-gold/20 text-gold-strong"}`}
                >
                  {t(`roles.${agent.role}`)}
                </span>
                {agent.id === me?.id && <span className="ml-1 text-xs text-muted">({t("you")})</span>}{" "}
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
              <ResetLinkButton userId={agent.id} />
              {agent.id !== me?.id && (
                <ActionForm action={toggleAgentAction}>
                  <input type="hidden" name="id" value={agent.id} />
                  <SubmitButton className={`${agent.active ? "btn-danger" : "btn-primary"} py-1.5 text-xs`}>
                    {agent.active ? t("deactivate") : t("activate")}
                  </SubmitButton>
                </ActionForm>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="p-5 text-muted">{t("empty")}</p>}
      </div>

      <section id="new-user" className="card scroll-mt-24 p-5">
        <h2 className="font-display text-lg font-bold">{t("newAgent")}</h2>
        <ActionForm
          action={createAgentAction}
          success={t("created")}
          className="mt-3 grid gap-3 sm:grid-cols-5 sm:items-end"
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
          <div>
            <label className="label" htmlFor="ag-role">
              {t("role")}
            </label>
            <select id="ag-role" name="role" defaultValue="AGENT" className="input">
              <option value="AGENT">{t("roles.AGENT")}</option>
              <option value="ADMIN">{t("roles.ADMIN")}</option>
            </select>
          </div>
          <SubmitButton>{t("create")}</SubmitButton>
        </ActionForm>
        <p className="mt-3 text-xs text-muted">{t("help")}</p>
        <p className={`mt-2 text-xs ${mailConfigured() ? "text-muted" : "text-gold-strong"}`}>
          {mailConfigured() ? t("mailOn") : t("mailOff")}
        </p>
      </section>
    </div>
  );
}
