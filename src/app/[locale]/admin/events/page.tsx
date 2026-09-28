import { getTranslations } from "next-intl/server";
import {
  addMarketAction,
  cancelEventAction,
  setAllMarketsAction,
  settleEventAction,
  startLiveAction,
  toggleMarketAction,
  updateLiveAction,
  updateOddsAction,
} from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { EventForm } from "@/components/admin/EventForm";
import { LocalTime } from "@/components/LocalTime";
import { prisma } from "@/lib/db";
import { codeLabel, marketLabel } from "@/lib/labels";
import { MARKET_TYPES } from "@/lib/sports-rules";

export default async function AdminEvents() {
  const [t, ts] = await Promise.all([getTranslations("admin"), getTranslations("sports")]);
  const tr = (k: string, v?: Record<string, string | number>) => ts(k, v);
  const [open, recent] = await Promise.all([
    prisma.event.findMany({
      where: { status: { in: ["SCHEDULED", "LIVE"] } },
      orderBy: [{ status: "asc" }, { startsAt: "asc" }],
      include: { markets: { orderBy: { sort: "asc" }, include: { selections: { orderBy: { id: "asc" } } } } },
    }),
    prisma.event.findMany({
      where: { status: { in: ["SETTLED", "CANCELLED"] } },
      orderBy: { startsAt: "desc" },
      take: 10,
    }),
  ]);
  const exposure = await prisma.betLeg.groupBy({
    by: ["selectionId"],
    where: { bet: { status: "OPEN" } },
    _count: { _all: true },
  });
  const legCount = new Map(exposure.map((e) => [e.selectionId, e._count._all]));
  const now = new Date();

  return (
    <div className="space-y-8">
      <section className="card p-5">
        <h2 className="font-display text-lg font-bold">{t("events.create")}</h2>
        <EventForm />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("events.open")}</h2>
        <div className="space-y-3">
          {open.map((e) => {
            const isLive = e.status === "LIVE";
            const suspended = e.markets.filter((m) => m.status === "SUSPENDED").length;
            return (
              <article key={e.id} className={`card p-4 text-sm ${isLive ? "border-danger/50" : ""}`}>
                <div className="flex flex-wrap items-baseline gap-3">
                  {isLive && <span className="chip bg-danger text-white">{ts("live")}</span>}
                  <p className="font-semibold">
                    {e.homeTeam} vs {e.awayTeam}
                    {isLive && (
                      <span className="ml-2 font-display tabular-nums">
                        {e.homeScore} - {e.awayScore}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {ts(`sportNames.${e.sport}`)} · {e.league} · <LocalTime value={e.startsAt} />
                    {e.externalId && ` · feed:${e.externalId}`}
                  </p>
                  {!isLive && e.startsAt < now && (
                    <span className="chip bg-gold/15 text-gold">{t("events.started")}</span>
                  )}
                  {suspended > 0 && (
                    <span className="chip bg-danger/15 text-danger">
                      {t("events.suspendedCount", { count: suspended })}
                    </span>
                  )}
                </div>

                {/* Live console */}
                <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-surface-2 p-3">
                  {isLive ? (
                    <ActionForm
                      action={updateLiveAction}
                      resetOnSuccess={false}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="eventId" value={e.id} />
                      <div>
                        <label className="label" htmlFor={`lh-${e.id}`}>
                          {e.homeTeam}
                        </label>
                        <input
                          id={`lh-${e.id}`}
                          name="homeScore"
                          type="number"
                          min="0"
                          defaultValue={e.homeScore ?? 0}
                          required
                          className="input w-20"
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor={`la-${e.id}`}>
                          {e.awayTeam}
                        </label>
                        <input
                          id={`la-${e.id}`}
                          name="awayScore"
                          type="number"
                          min="0"
                          defaultValue={e.awayScore ?? 0}
                          required
                          className="input w-20"
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor={`lc-${e.id}`}>
                          {t("events.clock")}
                        </label>
                        <input
                          id={`lc-${e.id}`}
                          name="clock"
                          defaultValue={e.clock ?? ""}
                          className="input w-24"
                          placeholder="67'"
                        />
                      </div>
                      <SubmitButton className="btn-ghost">{t("events.updateLive")}</SubmitButton>
                    </ActionForm>
                  ) : (
                    <ActionForm action={startLiveAction}>
                      <input type="hidden" name="eventId" value={e.id} />
                      <SubmitButton className="btn-ghost">▶ {t("events.startLive")}</SubmitButton>
                    </ActionForm>
                  )}
                  <ActionForm action={setAllMarketsAction} className="flex gap-2">
                    <input type="hidden" name="eventId" value={e.id} />
                    <button name="status" value="SUSPENDED" className="btn-danger py-2">
                      🔒 {t("events.suspendAll")}
                    </button>
                    <button name="status" value="OPEN" className="btn-ghost py-2">
                      {t("events.openAll")}
                    </button>
                  </ActionForm>
                  {isLive && <p className="w-full text-[11px] text-muted">{t("events.liveHint")}</p>}
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-brand">
                    {t("events.markets", { count: e.markets.length })}
                  </summary>
                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    {e.markets.map((m) => {
                      const mk = { type: m.type, line: m.line === null ? null : Number(m.line) };
                      return (
                        <div key={m.id} className="rounded-xl bg-surface-2 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted">{marketLabel(tr, e.sport, mk)}</span>
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
                              <span className="w-16 truncate text-xs">{codeLabel(tr, e, mk, s.code)}</span>
                              <input
                                name="odds"
                                type="number"
                                step="0.01"
                                min="1.01"
                                defaultValue={s.odds.toFixed(2)}
                                aria-label={s.code}
                                className="input py-1 tabular-nums"
                              />
                              <span className="w-8 text-right text-[11px] text-muted" title={t("events.legs")}>
                                {legCount.get(s.id) ?? 0}
                              </span>
                              <button className="text-xs text-brand" aria-label={t("save")}>
                                ✓
                              </button>
                            </ActionForm>
                          ))}
                        </div>
                      );
                    })}
                  </div>

                  <ActionForm
                    action={addMarketAction}
                    success={t("done")}
                    className="mt-3 grid items-end gap-2 rounded-xl border border-dashed border-line p-3 sm:grid-cols-[1fr_100px_2fr_auto]"
                  >
                    <input type="hidden" name="eventId" value={e.id} />
                    <div>
                      <label className="label" htmlFor={`mt-${e.id}`}>
                        {t("events.marketType")}
                      </label>
                      <select id={`mt-${e.id}`} name="type" className="input">
                        {MARKET_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type} · {ts(`markets.${type}`, { line: "" })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor={`ml-${e.id}`}>
                        {t("events.line")}
                      </label>
                      <input id={`ml-${e.id}`} name="line" className="input" placeholder="2.5" />
                    </div>
                    <div>
                      <label className="label" htmlFor={`ms-${e.id}`}>
                        {t("events.selections")}
                      </label>
                      <input
                        id={`ms-${e.id}`}
                        name="selections"
                        required
                        className="input font-mono text-xs"
                        placeholder="OVER=1.85, UNDER=1.95"
                      />
                    </div>
                    <SubmitButton className="btn-ghost">{t("events.addMarket")}</SubmitButton>
                  </ActionForm>
                </details>

                <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3">
                  <ActionForm action={settleEventAction} className="flex items-end gap-2">
                    <input type="hidden" name="eventId" value={e.id} />
                    <div>
                      <label className="label" htmlFor={`sh-${e.id}`}>
                        {e.homeTeam}
                      </label>
                      <input
                        id={`sh-${e.id}`}
                        name="homeScore"
                        type="number"
                        min="0"
                        defaultValue={e.homeScore ?? undefined}
                        required
                        className="input w-20"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor={`sa-${e.id}`}>
                        {e.awayTeam}
                      </label>
                      <input
                        id={`sa-${e.id}`}
                        name="awayScore"
                        type="number"
                        min="0"
                        defaultValue={e.awayScore ?? undefined}
                        required
                        className="input w-20"
                      />
                    </div>
                    <SubmitButton>{t("events.settle")}</SubmitButton>
                  </ActionForm>
                  <ActionForm action={cancelEventAction} className="ml-auto">
                    <input type="hidden" name="eventId" value={e.id} />
                    <SubmitButton className="btn-danger">{t("events.cancel")}</SubmitButton>
                  </ActionForm>
                </div>
              </article>
            );
          })}
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
