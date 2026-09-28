import { getLocale, getTranslations } from "next-intl/server";
import { cancelDrawAction, createDrawAction, settleDrawAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { DateTimeInput, LocalTime } from "@/components/LocalTime";
import { StateBadge } from "@/components/lottery/StateBadge";
import { prisma } from "@/lib/db";
import { ensureUpcomingDraws } from "@/lib/lottery";
import { formatMoney } from "@/lib/money";

export default async function AdminLottery() {
  const [locale, t, tl] = await Promise.all([getLocale(), getTranslations("admin"), getTranslations("lottery")]);
  await ensureUpcomingDraws();
  const now = new Date();
  const include = { tickets: { select: { totalStake: true, currency: true } } };
  const [awaiting, upcoming, recent] = await Promise.all([
    // Held (or closed custom) draws still waiting for official numbers.
    prisma.lotteryDraw.findMany({
      where: { status: "OPEN", OR: [{ drawAt: { lte: now } }, { drawAt: null, closesAt: { lte: now } }] },
      orderBy: [{ drawAt: "asc" }, { closesAt: "asc" }],
      include,
    }),
    prisma.lotteryDraw.findMany({
      where: { status: "OPEN", OR: [{ drawAt: { gt: now } }, { drawAt: null, closesAt: { gt: now } }] },
      orderBy: [{ closesAt: "asc" }],
      take: 14,
      include,
    }),
    prisma.lotteryDraw.findMany({
      where: { status: { not: "OPEN" } },
      orderBy: [{ drawAt: "desc" }, { closesAt: "desc" }],
      take: 15,
      include,
    }),
  ]);

  type Draw = (typeof awaiting)[number];
  const label = (d: Draw) => (d.lottery ? `${tl(`lotteries.${d.lottery}`)} · ${tl(`sessions.${d.session}`)}` : d.name);
  const stakes = (d: Draw) =>
    Object.entries(
      d.tickets.reduce<Record<string, number>>((acc, tk) => {
        acc[tk.currency] = (acc[tk.currency] ?? 0) + Number(tk.totalStake);
        return acc;
      }, {}),
    )
      .map(([c, v]) => formatMoney(v, c, locale))
      .join(" · ");

  const DrawRow = ({ d, settle }: { d: Draw; settle: boolean }) => (
    <article className="card p-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <StateBadge code={d.lottery} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{label(d)}</p>
          <p className="text-xs text-muted">
            <LocalTime value={d.drawAt ?? d.closesAt} /> · {t("lottery.tickets", { count: d.tickets.length })}
            {d.tickets.length > 0 && ` · ${stakes(d)}`}
          </p>
        </div>
        {d.first && (
          <span className="font-display font-bold text-gold-strong tabular-nums">
            {d.pick3 ? `P3 ${d.pick3} · P4 ${d.pick4}` : `${d.first} · ${d.second} · ${d.third}`}
          </span>
        )}
        {d.status !== "OPEN" && <span className="chip bg-surface-2">{d.status}</span>}
      </div>
      {settle && (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3">
          <ActionForm action={settleDrawAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="drawId" value={d.id} />
            {d.lottery ? (
              <>
                <div>
                  <label className="label" htmlFor={`p3-${d.id}`}>
                    {t("lottery.pick3")}
                  </label>
                  <input
                    id={`p3-${d.id}`}
                    name="pick3"
                    required
                    pattern="\d{3}"
                    maxLength={3}
                    inputMode="numeric"
                    className="input w-24 text-center font-bold tracking-widest"
                    placeholder="347"
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`p4-${d.id}`}>
                    {t("lottery.pick4")}
                  </label>
                  <input
                    id={`p4-${d.id}`}
                    name="pick4"
                    required
                    pattern="\d{4}"
                    maxLength={4}
                    inputMode="numeric"
                    className="input w-28 text-center font-bold tracking-widest"
                    placeholder="1285"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label" htmlFor={`f-${d.id}`}>
                    {t("lottery.first")}
                  </label>
                  <input
                    id={`f-${d.id}`}
                    name="first"
                    required
                    pattern="\d{3}"
                    maxLength={3}
                    className="input w-24 text-center font-bold"
                    placeholder="123"
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`s-${d.id}`}>
                    {t("lottery.second")}
                  </label>
                  <input
                    id={`s-${d.id}`}
                    name="second"
                    required
                    pattern="\d{2}"
                    maxLength={2}
                    className="input w-20 text-center font-bold"
                    placeholder="45"
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`t-${d.id}`}>
                    {t("lottery.third")}
                  </label>
                  <input
                    id={`t-${d.id}`}
                    name="third"
                    required
                    pattern="\d{2}"
                    maxLength={2}
                    className="input w-20 text-center font-bold"
                    placeholder="67"
                  />
                </div>
              </>
            )}
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

  return (
    <div className="space-y-8">
      <p className="rounded-2xl bg-brand/15 p-4 text-sm text-ink">{t("lottery.scheduled")}</p>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("lottery.awaiting")}</h2>
        <div className="space-y-3">
          {awaiting.map((d) => (
            <DrawRow key={d.id} d={d} settle />
          ))}
          {awaiting.length === 0 && <p className="card p-5 text-sm text-muted">{t("empty")}</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("lottery.upcoming")}</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {upcoming.map((d) => (
            <DrawRow key={d.id} d={d} settle={false} />
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-display text-lg font-bold">{t("lottery.custom")}</h2>
        <ActionForm
          action={createDrawAction}
          success={t("done")}
          className="mt-4 grid items-end gap-3 sm:grid-cols-[2fr_2fr_auto]"
        >
          <div>
            <label className="label" htmlFor="draw-name">
              {t("lottery.name")}
            </label>
            <input id="draw-name" name="name" required className="input" placeholder="Port-au-Prince · Soir" />
          </div>
          <div>
            <label className="label">{t("lottery.closesAt")}</label>
            <DateTimeInput name="closesAt" required />
          </div>
          <SubmitButton>{t("lottery.createCta")}</SubmitButton>
        </ActionForm>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("payments.recent")}</h2>
        <div className="space-y-2">
          {recent.map((d) => (
            <DrawRow key={d.id} d={d} settle={false} />
          ))}
        </div>
      </section>
    </div>
  );
}
