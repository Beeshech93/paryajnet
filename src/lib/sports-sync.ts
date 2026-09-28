/**
 * Keeps sports data in sync with The Odds API: upcoming games and odds, live
 * scores and final results (which settle confirmed services automatically).
 * Throttled to protect the API quota; state is kept in Setting rows.
 */
import { prisma } from "./db";
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

/** Fetch upcoming games and odds for the configured leagues. */
export async function syncOdds({ force = false } = {}) {
  if (!oddsApiKey()) return { skipped: "no_key" as const };
  const cfg = await sportsDataConfig();
  const last = Number(await getSetting("odds.lastOddsSync"));
  if (!force && last && Date.now() - last < cfg.oddsHours * 3_600_000) return { skipped: "fresh" as const };
  // After a failed run (bad key, API down) retry sooner instead of waiting a full interval.
  const failed = Number(await getSetting("odds.lastOddsFailure"));
  if (!force && failed && Date.now() - failed < RETRY_MS) return { skipped: "retry_later" as const };
  if (!(await tryLock("odds.lockOdds", 5 * 60_000))) return { skipped: "running" as const };
  const summary: Record<string, string> = {};
  let succeeded = 0;
  try {
    for (const sportKey of cfg.sports) {
      const sport = sportOf(sportKey);
      if (!sport) continue;
      try {
        const { data, remaining } = await oddsApi.odds(sportKey, marketsFor(sportKey));
        await recordQuota(remaining);
        const now = Date.now();
        const events: FeedPayload["events"] = data
          .filter((e) => new Date(e.commence_time).getTime() > now)
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
        succeeded++;
      } catch (err) {
        summary[sportKey] = `error: ${String(err).slice(0, 120)}`;
      }
    }
    await setSetting(succeeded > 0 || cfg.sports.length === 0 ? "odds.lastOddsSync" : "odds.lastOddsFailure", String(Date.now()));
    await setSetting("odds.lastOddsResult", JSON.stringify(summary));
    return { summary };
  } finally {
    await unlock("odds.lockOdds");
  }
}

/** Live scores and results — only for leagues with started, unsettled games. */
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
  const last = Number(await getSetting("odds.lastScoresSync"));
  if (!force && last && Date.now() - last < cfg.scoresMinutes * 60_000) return { skipped: "fresh" as const };
  if (!(await tryLock("odds.lockScores", 5 * 60_000))) return { skipped: "running" as const };
  const byId = new Map(pending.map((e) => [e.externalId!, e]));
  const sportKeys = [...new Set(pending.map((e) => e.externalId!.split(":")[1]))];
  const summary: Record<string, string> = {};
  try {
    for (const sportKey of sportKeys) {
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
      } catch (err) {
        summary[sportKey] = `error: ${String(err).slice(0, 120)}`;
      }
    }
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
