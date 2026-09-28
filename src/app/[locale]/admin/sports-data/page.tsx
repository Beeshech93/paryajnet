import { getTranslations } from "next-intl/server";
import {
  removeDemoEventsAction,
  saveSportsDataAction,
  syncOddsNowAction,
  syncScoresNowAction,
} from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { LocalTime } from "@/components/LocalTime";
import { prisma } from "@/lib/db";
import { oddsApi, oddsApiKey, sportOf, type ApiSport } from "@/lib/odds-api";
import { getSetting } from "@/lib/settings";
import { sportsDataConfig } from "@/lib/sports-sync";

export const dynamic = "force-dynamic";
// "Update now" runs the sync inside this page's server action.
export const maxDuration = 60;

export default async function AdminSportsData() {
  const t = await getTranslations("admin.sportsData");
  const configured = !!oddsApiKey();
  const cfg = await sportsDataConfig();
  let sports: ApiSport[] = [];
  let listError: string | null = null;
  if (configured) {
    try {
      sports = (await oddsApi.sports()).data.filter((s) => sportOf(s.key) && !s.has_outrights);
    } catch (err) {
      listError = String(err).slice(0, 200);
    }
  }
  const [quota, lastOdds, lastScores, oddsResult, scoresResult, apiEvents, demoEvents] = await Promise.all([
    getSetting("odds.quotaRemaining"),
    getSetting("odds.lastOddsSync"),
    getSetting("odds.lastScoresSync"),
    getSetting("odds.lastOddsResult"),
    getSetting("odds.lastScoresResult"),
    prisma.event.count({ where: { externalId: { startsWith: "oddsapi:" }, status: { in: ["SCHEDULED", "LIVE"] } } }),
    prisma.event.count({ where: { externalId: null, status: { in: ["SCHEDULED", "LIVE"] } } }),
  ]);
  const parse = (v: string | null) => (v ? (JSON.parse(v) as Record<string, string>) : {});
  const known = new Set(sports.map((s) => s.key));
  const selectedMissing = cfg.sports.filter((k) => !known.has(k));
  const credits = cfg.sports.reduce((a, k) => a + (sportOf(k) === "basketball" ? 3 : 2), 0);
  const monthly = Math.round(credits * (720 / cfg.oddsHours));
  const leagueStatus = await Promise.all(
    cfg.sports.map(async (k) => ({ key: k, last: Number(await getSetting(`odds.o.${k}`)) || 0 })),
  );
  const pendingLeagues = leagueStatus.filter((l) => Date.now() - l.last >= cfg.oddsHours * 3_600_000).length;
  const overBudget = quota !== null && monthly > Number(quota);

  return (
    <div className="space-y-6">
      <section className="card space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-xl font-bold">{t("title")}</h1>
          <span className={`chip ${configured ? "bg-brand/15 text-brand-strong" : "bg-danger/15 text-danger"}`}>
            {configured ? t("connected") : t("notConfigured")}
          </span>
          {quota && <span className="text-sm text-muted">{t("quota", { remaining: quota })}</span>}
        </div>
        <p className="text-sm text-muted">{t("intro")}</p>
        {!configured && (
          <div className="space-y-2 rounded-xl bg-gold/10 p-4 text-sm">
            <p>{t("setup")}</p>
            <pre className="overflow-x-auto rounded-lg bg-bg p-3 font-mono text-xs">ODDS_API_KEY=…</pre>
          </div>
        )}
        {listError && <p className="rounded-xl bg-danger/10 p-3 font-mono text-xs text-danger">{listError}</p>}
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="label">{t("lastOdds")}</p>
            <p>
              {lastOdds ? <LocalTime value={new Date(Number(lastOdds))} /> : "—"} · {t("games", { count: apiEvents })}
            </p>
            <ul className="mt-1 text-xs text-muted">
              {Object.entries(parse(oddsResult)).map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="label">{t("lastScores")}</p>
            <p>{lastScores ? <LocalTime value={new Date(Number(lastScores))} /> : "—"}</p>
            <ul className="mt-1 text-xs text-muted">
              {Object.entries(parse(scoresResult)).map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
            </ul>
          </div>
        </div>
        {configured && pendingLeagues > 0 && (
          <p className="rounded-xl bg-gold/10 p-3 text-sm text-gold-strong">
            {t("pendingLeagues", { count: pendingLeagues })}
          </p>
        )}
        {configured && overBudget && (
          <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">
            {t("overBudget", { monthly, quota: quota ?? 0 })}
          </p>
        )}
        {configured && (
          <div className="flex flex-wrap gap-2">
            <ActionForm action={syncOddsNowAction} success={t("synced")}>
              <SubmitButton>↻ {t("syncOdds")}</SubmitButton>
            </ActionForm>
            <ActionForm action={syncScoresNowAction} success={t("synced")}>
              <SubmitButton className="btn-ghost">↻ {t("syncScores")}</SubmitButton>
            </ActionForm>
          </div>
        )}
      </section>

      <ActionForm
        action={saveSportsDataAction}
        success={t("saved")}
        resetOnSuccess={false}
        className="card space-y-4 p-5"
      >
        <h2 className="font-display text-lg font-bold">{t("leagues")}</h2>
        {sports.length > 0 ? (
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {[...sports]
              .sort(
                (a, b) =>
                  Number(cfg.sports.includes(b.key)) - Number(cfg.sports.includes(a.key)) ||
                  a.group.localeCompare(b.group) ||
                  a.title.localeCompare(b.title),
              )
              .map((s) => (
                <label key={s.key} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    name="sports"
                    value={s.key}
                    defaultChecked={cfg.sports.includes(s.key)}
                    className="accent-brand"
                  />
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                  <span className="text-[10px] text-muted">{sportOf(s.key) === "basketball" ? "🏀" : "⚽"}</span>
                </label>
              ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {cfg.sports.map((k) => (
              <label key={k} className="chip border border-line px-3 py-1.5">
                <input type="checkbox" name="sports" value={k} defaultChecked className="mr-1.5 accent-brand" /> {k}
              </label>
            ))}
          </div>
        )}
        {selectedMissing.length > 0 && sports.length > 0 && (
          <p className="text-xs text-muted">{t("outOfSeason", { leagues: selectedMissing.join(", ") })}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="sd-margin">
              {t("margin")}
            </label>
            <input
              id="sd-margin"
              name="marginPct"
              type="number"
              step="0.5"
              min="0"
              max="20"
              defaultValue={cfg.marginPct}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="sd-hours">
              {t("oddsHours")}
            </label>
            <input
              id="sd-hours"
              name="oddsHours"
              type="number"
              min="1"
              max="168"
              defaultValue={cfg.oddsHours}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="sd-min">
              {t("scoresMinutes")}
            </label>
            <input
              id="sd-min"
              name="scoresMinutes"
              type="number"
              min="5"
              max="1440"
              defaultValue={cfg.scoresMinutes}
              className="input"
            />
          </div>
        </div>
        <p className="text-xs text-muted">{t("costHint", { credits, monthly })}</p>
        <SubmitButton>{t("save")}</SubmitButton>
      </ActionForm>

      {demoEvents > 0 && (
        <section className="card flex flex-wrap items-center gap-3 p-5 text-sm">
          <p className="flex-1">{t("demo", { count: demoEvents })}</p>
          <ActionForm action={removeDemoEventsAction} success={t("demoRemoved")}>
            <SubmitButton className="btn-danger">{t("removeDemo")}</SubmitButton>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
