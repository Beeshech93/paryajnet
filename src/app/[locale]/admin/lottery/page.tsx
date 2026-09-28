import { getLocale, getTranslations } from "next-intl/server";
import { cancelDrawAction, createDrawAction, settleDrawAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { DateTimeInput, LocalTime } from "@/components/LocalTime";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export default async function AdminLottery() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("admin")]);
  const draws = await prisma.lotteryDraw.findMany({
    orderBy: { closesAt: "desc" },
    take: 30,
    include: { tickets: { select: { totalStake: true, currency: true } } },
  });

  return (
    <div className="space-y-8">
      <section className="card p-5">
        <h2 className="font-display text-lg font-bold">{t("lottery.create")}</h2>
        <ActionForm
          action={createDrawAction}
          success={t("done")}
          className="mt-4 grid items-end gap-3 sm:grid-cols-[2fr_2fr_auto]"
        >
          <div>
            <label className="label">{t("lottery.name")}</label>
            <input name="name" required className="input" placeholder="Rio · Tarde" />
          </div>
          <div>
            <label className="label">{t("lottery.closesAt")}</label>
            <DateTimeInput name="closesAt" required />
          </div>
          <SubmitButton>{t("lottery.createCta")}</SubmitButton>
        </ActionForm>
      </section>

      <section className="space-y-3">
        {draws.map((d) => {
          const stakes = d.tickets.reduce<Record<string, number>>((acc, tk) => {
            acc[tk.currency] = (acc[tk.currency] ?? 0) + Number(tk.totalStake);
            return acc;
          }, {});
          return (
            <article key={d.id} className="card p-4 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-semibold">{d.name}</p>
                <p className="text-xs text-muted">
                  <LocalTime value={d.closesAt} />
                </p>
                <span className="chip bg-surface-2">{d.status}</span>
                <span className="text-xs text-muted">
                  {t("lottery.tickets", { count: d.tickets.length })}
                  {Object.entries(stakes).map(([c, v]) => ` · ${formatMoney(v, c, locale)}`)}
                </span>
                {d.first && (
                  <span className="ml-auto font-display font-bold text-gold-strong">
                    {d.first} · {d.second} · {d.third}
                  </span>
                )}
              </div>
              {d.status === "OPEN" && (
                <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3">
                  <ActionForm action={settleDrawAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="drawId" value={d.id} />
                    <div>
                      <label className="label">{t("lottery.first")}</label>
                      <input
                        name="first"
                        required
                        pattern="\d{3}"
                        maxLength={3}
                        className="input w-24 text-center font-bold"
                        placeholder="123"
                      />
                    </div>
                    <div>
                      <label className="label">{t("lottery.second")}</label>
                      <input
                        name="second"
                        required
                        pattern="\d{2}"
                        maxLength={2}
                        className="input w-20 text-center font-bold"
                        placeholder="45"
                      />
                    </div>
                    <div>
                      <label className="label">{t("lottery.third")}</label>
                      <input
                        name="third"
                        required
                        pattern="\d{2}"
                        maxLength={2}
                        className="input w-20 text-center font-bold"
                        placeholder="67"
                      />
                    </div>
                    <SubmitButton>{t("lottery.settle")}</SubmitButton>
                  </ActionForm>
                  <ActionForm action={cancelDrawAction} className="ml-auto">
                    <input type="hidden" name="drawId" value={d.id} />
                    <SubmitButton className="btn-danger">{t("lottery.cancel")}</SubmitButton>
                  </ActionForm>
                </div>
              )}
            </article>
          );
        })}
        {draws.length === 0 && <p className="card p-5 text-sm text-muted">{t("empty")}</p>}
      </section>
    </div>
  );
}
