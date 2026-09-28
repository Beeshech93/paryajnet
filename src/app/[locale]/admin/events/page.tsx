import { getTranslations } from "next-intl/server";
import {
  cancelEventAction,
  createEventAction,
  settleEventAction,
  toggleMarketAction,
  updateOddsAction,
} from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { DateTimeInput, LocalTime } from "@/components/LocalTime";
import { prisma } from "@/lib/db";

const ODDS_FIELDS = [
  ["o1", "1", "2.10"],
  ["oX", "X", "3.30"],
  ["o2", "2", "3.40"],
  ["oOver", "OVER", "1.90"],
  ["oUnder", "UNDER", "1.90"],
  ["oYes", "YES", "1.80"],
  ["oNo", "NO", "2.00"],
] as const;

export default async function AdminEvents() {
  const [t, ts] = await Promise.all([getTranslations("admin"), getTranslations("sports")]);
  const [open, recent] = await Promise.all([
    prisma.event.findMany({
      where: { status: "SCHEDULED" },
      orderBy: { startsAt: "asc" },
      include: { markets: { include: { selections: true } } },
    }),
    prisma.event.findMany({ where: { status: { not: "SCHEDULED" } }, orderBy: { startsAt: "desc" }, take: 10 }),
  ]);
  const exposure = await prisma.betLeg.groupBy({
    by: ["selectionId"],
    where: { bet: { status: "OPEN" } },
    _count: { _all: true },
  });
  const legCount = new Map(exposure.map((e) => [e.selectionId, e._count._all]));

  return (
    <div className="space-y-8">
      <section className="card p-5">
        <h2 className="font-display text-lg font-bold">{t("events.create")}</h2>
        <ActionForm action={createEventAction} success={t("done")} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="label">{t("events.sport")}</label>
              <select name="sport" className="input" defaultValue="football">
                <option value="football">{ts("sportNames.football")}</option>
                <option value="basketball">{ts("sportNames.basketball")}</option>
              </select>
            </div>
            <div>
              <label className="label">{t("events.league")}</label>
              <input name="league" required className="input" placeholder="Brasileirão Série A" />
            </div>
            <div>
              <label className="label">{t("events.home")}</label>
              <input name="homeTeam" required className="input" />
            </div>
            <div>
              <label className="label">{t("events.away")}</label>
              <input name="awayTeam" required className="input" />
            </div>
            <div>
              <label className="label">{t("events.startsAt")}</label>
              <DateTimeInput name="startsAt" required />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
            {ODDS_FIELDS.map(([name, code, def]) => (
              <div key={name}>
                <label className="label">{ts(`codes.${code}`)}</label>
                <input
                  name={name}
                  type="number"
                  step="0.01"
                  min="1.01"
                  defaultValue={def}
                  required
                  className="input tabular-nums"
                />
              </div>
            ))}
          </div>
          <SubmitButton>{t("events.createCta")}</SubmitButton>
        </ActionForm>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("events.open")}</h2>
        <div className="space-y-3">
          {open.map((e) => (
            <article key={e.id} className="card p-4 text-sm">
              <div className="flex flex-wrap items-baseline gap-3">
                <p className="font-semibold">
                  {e.homeTeam} vs {e.awayTeam}
                </p>
                <p className="text-xs text-muted">
                  {e.league} · <LocalTime value={e.startsAt} />
                </p>
                {e.startsAt < new Date() && <span className="chip bg-gold/15 text-gold">{t("events.started")}</span>}
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                {e.markets.map((m) => (
                  <div key={m.id} className="rounded-xl bg-surface-2 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted">{ts(`markets.${m.type}`)}</span>
                      <ActionForm action={toggleMarketAction}>
                        <input type="hidden" name="marketId" value={m.id} />
                        <button
                          className={`chip ${m.status === "OPEN" ? "bg-brand/15 text-brand" : "bg-danger/15 text-danger"}`}
                        >
                          {m.status === "OPEN" ? t("events.open_") : t("events.suspended")}
                        </button>
                      </ActionForm>
                    </div>
                    {m.selections.map((s) => (
                      <ActionForm
                        key={s.id}
                        action={updateOddsAction}
                        resetOnSuccess={false}
                        className="mb-1 flex items-center gap-2"
                      >
                        <input type="hidden" name="selectionId" value={s.id} />
                        <span className="w-16 text-xs">{ts(`codes.${s.code}`)}</span>
                        <input
                          name="odds"
                          type="number"
                          step="0.01"
                          min="1.01"
                          defaultValue={s.odds.toFixed(2)}
                          className="input py-1 tabular-nums"
                        />
                        <span className="w-10 text-right text-[11px] text-muted" title={t("events.legs")}>
                          {legCount.get(s.id) ?? 0}
                        </span>
                        <button className="text-xs text-brand">✓</button>
                      </ActionForm>
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3">
                <ActionForm action={settleEventAction} className="flex items-end gap-2">
                  <input type="hidden" name="eventId" value={e.id} />
                  <div>
                    <label className="label">{e.homeTeam}</label>
                    <input name="homeScore" type="number" min="0" required className="input w-20" />
                  </div>
                  <div>
                    <label className="label">{e.awayTeam}</label>
                    <input name="awayScore" type="number" min="0" required className="input w-20" />
                  </div>
                  <SubmitButton>{t("events.settle")}</SubmitButton>
                </ActionForm>
                <ActionForm action={cancelEventAction} className="ml-auto">
                  <input type="hidden" name="eventId" value={e.id} />
                  <SubmitButton className="btn-danger">{t("events.cancel")}</SubmitButton>
                </ActionForm>
              </div>
            </article>
          ))}
          {open.length === 0 && <p className="card p-5 text-sm text-muted">{t("empty")}</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("events.recent")}</h2>
        <div className="card divide-y divide-line text-sm">
          {recent.map((e) => (
            <div key={e.id} className="flex gap-3 px-4 py-2">
              <span className="flex-1">
                {e.homeTeam} vs {e.awayTeam}
              </span>
              <span className="tabular-nums">
                {e.status === "SETTLED" ? `${e.homeScore} - ${e.awayScore}` : t("events.cancelled")}
              </span>
            </div>
          ))}
          {recent.length === 0 && <p className="p-4 text-muted">{t("empty")}</p>}
        </div>
      </section>
    </div>
  );
}
