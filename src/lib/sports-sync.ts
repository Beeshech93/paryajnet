/**
 * Keeps sports data in sync with The Odds API: upcoming games and odds, live
 * scores and final results (which settle confirmed services automatically).
 * Throttled to protect the API quota; state is kept in Setting rows.
 */
import { prisma } from "./db";
import { mapLimit } from "./concurrency";
import { ingestFeed, type FeedPayload } from "./feed";
import { DEFAULT_SPORTS, marketsFor, marketsFromApi, oddsApi, oddsApiKey, scoreOf, sportOf } from "./odds-api";
import { getSetting, setSetting, tryLock, unlock } from "./settings";

export type SportsDataConfig = { sports: string[]; marginPct: number; oddsHours: number; scoresMinutes: number };

export async function sportsDataConfig(): Promise<SportsDataConfig> {
  const [sports, margin, oddsHours, scoresMinutes] = await Promise.all([
    getSetting("odds.sports"),
    getSetting("odds.margin"),
    getSetting("odds.hours"),
    getSetting("odds.scoresMinutes"),
  ]);
  return {
    sports: sports ? sports.split(",").filter(Boolean) : DEFAULT_SPORTS,
    marginPct: margin ? Number(margin) : 3,
    oddsHours: oddsHours ? Number(oddsHours) : 12,
    scoresMinutes: scoresMinutes ? Number(scoresMinutes) : 30,
  };
}

export async function saveSportsDataConfig(c: SportsDataConfig) {
  await Promise.all([
    setSetting("odds.sports", c.sports.join(",")),
    setSetting("odds.margin", String(c.marginPct)),
    setSetting("odds.hours", String(c.oddsHours)),
    setSetting("odds.scoresMinutes", String(c.scoresMinutes)),
  ]);
}

/** Wait this long before retrying after a run where every league failed. */
const RETRY_MS = 15 * 60_000;

const externalId = (sportKey: string, id: string) => `oddsapi:${sportKey}:${id}`;

async function recordQuota(remaining: number | null) {
  if (remaining !== null) await setSetting("odds.quotaRemaining", String(remaining));
}

/** Stop starting new API calls after this long, so the serverless function is never cut off mid-way. */
const TIME_BUDGET_MS = 40_000;
/** Keep this many credits in reserve so results (which settle services) can still be fetched. */
const QUOTA_RESERVE = 20;
const leagueKey = (kind: "o" | "s", sportKey: string) => `odds.${kind}.${sportKey}`;

async function quotaLeft(): Promise<number | null> {
  const v = await getSetting("odds.quotaRemaining");
  return v === null ? null : Number(v);
}

/**
 * Fetch upcoming games and odds. Each league keeps its own last-sync time, so a
 * run that hits the time budget continues with the remaining leagues next time
 * instead of starting over (and spending credits twice).
 */
export async function syncOdds({ force = false } = {}) {
  if (!oddsApiKey()) return { skipped: "no_key" as const };
  const cfg = await sportsDataConfig();
  const now = Date.now();
  const leagues = cfg.sports.filter((k) => sportOf(k));
  const last = await Promise.all(leagues.map(async (k) => Number(await getSetting(leagueKey("o", k))) || 0));
  const due = leagues
    .map((k, i) => ({ k, last: last[i] }))
    .filter((l) => force || now - l.last >= cfg.oddsHours * 3_600_000)
    .sort((a, b) => a.last - b.last)
    .map((l) => l.k);
  if (due.length === 0) return { skipped: "fresh" as const };
  if (!(await tryLock("odds.lockOdds", 2 * 60_000))) return { skipped: "running" as const };

  const started = Date.now();
  const summary: Record<string, string> = JSON.parse((await getSetting("odds.lastOddsResult")) ?? "{}");
  let done = 0;
  let stopped: string | null = null;
  try {
    await mapLimit(due, 4, async (sportKey) => {
      if (Date.now() - started > TIME_BUDGET_MS) return (stopped ??= "time");
      const left = await quotaLeft();
      if (left !== null && left < marketsFor(sportKey).length + QUOTA_RESERVE) return (stopped ??= "quota");
      const sport = sportOf(sportKey)!;
      try {
        const { data, remaining } = await oddsApi.odds(sportKey, marketsFor(sportKey));
        await recordQuota(remaining);
        const events: FeedPayload["events"] = data
          .filter((e) => new Date(e.commence_time).getTime() > Date.now())
          .map((e) => ({
            externalId: externalId(sportKey, e.id),
            sport,
            league: e.sport_title,
            homeTeam: e.home_team,
            awayTeam: e.away_team,
            startsAt: new Date(e.commence_time),
            markets: marketsFromApi(e, cfg.marginPct).map((m) => ({ ...m, status: "OPEN" as const })),
          }))
          .filter((e) => e.markets.length > 0);
        const results = await ingestFeed({ events });
        const errors = results.filter((r) => r.action === "error").length;
        summary[sportKey] = `${events.length} games${errors ? `, ${errors} errors` : ""}`;
        await setSetting(leagueKey("o", sportKey), String(Date.now()));
        done++;
      } catch (err) {
        summary[sportKey] = `error: ${String(err).slice(0, 120)}`;
        // Retry this league sooner than a full interval.
        await setSetting(leagueKey("o", sportKey), String(Date.now() - cfg.oddsHours * 3_600_000 + RETRY_MS));
      }
    });
    for (const k of Object.keys(summary)) if (!leagues.includes(k)) delete summary[k];
    await setSetting("odds.lastOddsResult", JSON.stringify(summary));
    if (done > 0) await setSetting("odds.lastOddsSync", String(Date.now()));
    const pending = due.length - done;
    if (stopped === "quota") await setSetting("odds.quotaWarning", String(Date.now()));
    return { done, pending, stopped };
  } finally {
    await unlock("odds.lockOdds");
  }
}

/** Live scores and results — only for leagues with started, unsettled games, each on its own interval. */
export async function syncScores({ force = false } = {}) {
  if (!oddsApiKey()) return { skipped: "no_key" as const };
  const cfg = await sportsDataConfig();
  const pending = await prisma.event.findMany({
    where: {
      externalId: { startsWith: "oddsapi:" },
      status: { in: ["SCHEDULED", "LIVE"] },
      startsAt: { lt: new Date() },
    },
    select: { externalId: true, sport: true, league: true, homeTeam: true, awayTeam: true, startsAt: true },
  });
  if (pending.length === 0) return { skipped: "nothing_pending" as const };
  const now = Date.now();
  const allKeys = [...new Set(pending.map((e) => e.externalId!.split(":")[1]))];
  const last = await Promise.all(allKeys.map(async (k) => Number(await getSetting(leagueKey("s", k))) || 0));
  const due = allKeys.filter((_, i) => force || now - last[i] >= cfg.scoresMinutes * 60_000);
  if (due.length === 0) return { skipped: "fresh" as const };
  if (!(await tryLock("odds.lockScores", 2 * 60_000))) return { skipped: "running" as const };
  const byId = new Map(pending.map((e) => [e.externalId!, e]));
  const started = Date.now();
  const summary: Record<string, string> = {};
  try {
    await mapLimit(due, 4, async (sportKey) => {
      if (Date.now() - started > TIME_BUDGET_MS) return;
      const left = await quotaLeft();
      if (left !== null && left < 2) return;
      try {
        const { data, remaining } = await oddsApi.scores(sportKey, 3);
        await recordQuota(remaining);
        const events: FeedPayload["events"] = [];
        for (const s of data) {
          const ours = byId.get(externalId(sportKey, s.id));
          const score = scoreOf(s);
          if (!ours || !score) continue;
          events.push({
            externalId: ours.externalId!,
            sport: ours.sport as "football" | "basketball",
            league: ours.league,
            homeTeam: ours.homeTeam,
            awayTeam: ours.awayTeam,
            startsAt: ours.startsAt,
            status: s.completed ? "FINISHED" : "LIVE",
            homeScore: score.home,
            awayScore: score.away,
          });
        }
        const results = await ingestFeed({ events });
        summary[sportKey] = `${results.filter((r) => r.action === "settled").length} settled, ${events.length} updated`;
        await setSetting(leagueKey("s", sportKey), String(Date.now()));
      } catch (err) {
        summary[sportKey] = `error: ${String(err).slice(0, 120)}`;
      }
    });
    await setSetting("odds.lastScoresSync", String(Date.now()));
    await setSetting("odds.lastScoresResult", JSON.stringify(summary));
    return { summary };
  } finally {
    await unlock("odds.lockScores");
  }
}

/** Called after page views and by cron: each part runs only when its interval has passed. */
export async function autoSync() {
  try {
    await syncScores();
    await syncOdds();
  } catch (err) {
    console.error("[sports-sync]", err);
  }
}
