/**
 * The Odds API v4 (https://the-odds-api.com/liveapi/guides/v4/) — real fixtures,
 * bookmaker odds and scores. Pure mapping helpers are unit-tested in rules.test.ts.
 *
 * Quota: each /odds call costs [markets × regions] credits, /scores costs 1 (2 with daysFrom).
 */
import { footballMarkets, type MarketDraft } from "./pricing";

const BASE = process.env.ODDS_API_BASE ?? "https://api.the-odds-api.com/v4";

export type ApiOutcome = { name: string; price: number; point?: number };
export type ApiEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: { key: string; markets: { key: string; outcomes: ApiOutcome[] }[] }[];
};
export type ApiScore = {
  id: string;
  sport_key: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
};
export type ApiSport = { key: string; group: string; title: string; active: boolean; has_outrights: boolean };

/** Leagues offered by default (Brazil first). Admins can change them. */
export const DEFAULT_SPORTS = [
  "soccer_brazil_campeonato",
  "soccer_conmebol_copa_libertadores",
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_uefa_champs_league",
  "basketball_nba",
];

/** The key, tolerating common paste mistakes: spaces, quotes or a leading "ODDS_API_KEY=". */
export function oddsApiKey() {
  const raw = (process.env.ODDS_API_KEY ?? "")
    .trim()
    .replace(/^ODDS_API_KEY\s*=\s*/, "")
    .replace(/^["']|["']$/g, "")
    .trim();
  return raw || null;
}

async function get<T>(
  path: string,
  params: Record<string, string>,
): Promise<{ data: T; remaining: number | null; used: number | null }> {
  const key = oddsApiKey();
  if (!key) throw new Error("ODDS_API_KEY is not set");
  const url = new URL(`${BASE}${path}`);
  url.search = new URLSearchParams({ apiKey: key, ...params }).toString();
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const num = (h: string) => (res.headers.get(h) === null ? null : Number(res.headers.get(h)));
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`The Odds API ${res.status} ${path}: ${body.slice(0, 200)}`);
  }
  return { data: (await res.json()) as T, remaining: num("x-requests-remaining"), used: num("x-requests-used") };
}

export const oddsApi = {
  /** In-season sports. Free: doesn't use quota. */
  sports: () => get<ApiSport[]>("/sports", {}),
  /** Upcoming games with odds from EU bookmakers (decimal). */
  odds: (sportKey: string, markets: string[], days = 7) =>
    get<ApiEvent[]>(`/sports/${sportKey}/odds`, {
      regions: "eu",
      markets: markets.join(","),
      oddsFormat: "decimal",
      dateFormat: "iso",
      commenceTimeTo: new Date(Date.now() + days * 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z"),
    }),
  /** Live and recently completed games (up to 3 days back). */
  scores: (sportKey: string, daysFrom = 3) =>
    get<ApiScore[]>(`/sports/${sportKey}/scores`, { daysFrom: String(daysFrom) }),
};

export function sportOf(sportKey: string): "football" | "basketball" | null {
  if (sportKey.startsWith("soccer_")) return "football";
  if (sportKey.startsWith("basketball_")) return "basketball";
  return null;
}

/** Markets requested per sport (each one costs a credit per call). */
export function marketsFor(sportKey: string): string[] {
  return sportOf(sportKey) === "basketball" ? ["h2h", "spreads", "totals"] : ["h2h", "totals"];
}

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Our price from the bookmakers' consensus: median, shaded by the house margin (%), floored to 2 decimals. */
export function consensusPrice(prices: number[], marginPct: number): number | null {
  const ok = prices.filter((p) => Number.isFinite(p) && p > 1);
  if (ok.length === 0) return null;
  const m = median(ok);
  const shaded = 1 + (m - 1) * (1 - marginPct / 100);
  return Math.max(1.01, Math.floor(shaded * 100) / 100);
}

function collect(event: ApiEvent, marketKey: string) {
  const out: ApiOutcome[][] = [];
  for (const b of event.bookmakers ?? []) {
    const m = b.markets.find((x) => x.key === marketKey);
    if (m) out.push(m.outcomes);
  }
  return out;
}

/** Two-way line markets (totals / spreads), grouped by line; only lines quoted by ≥ `minBooks` bookmakers. */
function lineMarkets(event: ApiEvent, marketKey: "totals" | "spreads", marginPct: number, minBooks = 2) {
  const byLine = new Map<number, { a: number[]; b: number[] }>();
  for (const outcomes of collect(event, marketKey)) {
    if (marketKey === "totals") {
      const over = outcomes.find((o) => o.name === "Over");
      const under = outcomes.find((o) => o.name === "Under");
      if (!over || !under || over.point === undefined || over.point !== under.point) continue;
      const e = byLine.get(over.point) ?? { a: [], b: [] };
      e.a.push(over.price);
      e.b.push(under.price);
      byLine.set(over.point, e);
    } else {
      const home = outcomes.find((o) => o.name === event.home_team);
      const away = outcomes.find((o) => o.name === event.away_team);
      if (!home || !away || home.point === undefined || away.point !== -home.point) continue;
      const e = byLine.get(home.point) ?? { a: [], b: [] };
      e.a.push(home.price);
      e.b.push(away.price);
      byLine.set(home.point, e);
    }
  }
  const result: { line: number; a: number; b: number; books: number }[] = [];
  for (const [line, { a, b }] of byLine) {
    // Only half and whole lines (our settlement handles pushes on whole lines).
    if (a.length < minBooks || Math.round(line * 2) !== line * 2) continue;
    const pa = consensusPrice(a, marginPct);
    const pb = consensusPrice(b, marginPct);
    if (pa && pb) result.push({ line, a: pa, b: pb, books: a.length });
  }
  return result.sort((x, y) => y.books - x.books || x.line - y.line);
}

/**
 * Turn a The Odds API event into our market drafts. Football gets 1X2 and the
 * quoted totals from the bookmakers; the rest (double chance, BTTS, handicaps,
 * correct score) is derived with our Poisson model when a 2.5 total is available.
 */
export function marketsFromApi(event: ApiEvent, marginPct: number): MarketDraft[] {
  const sport = sportOf(event.sport_key);
  if (!sport) return [];
  const h2h = collect(event, "h2h");
  const price = (name: string) =>
    consensusPrice(
      h2h.map((o) => o.find((x) => x.name === name)?.price ?? NaN),
      marginPct,
    );

  if (sport === "football") {
    const [p1, pX, p2] = [price(event.home_team), price("Draw"), price(event.away_team)];
    if (!p1 || !pX || !p2) return [];
    const totals = lineMarkets(event, "totals", marginPct)
      .filter((t) => t.line <= 6.5)
      .slice(0, 3);
    const t25 = totals.find((t) => t.line === 2.5);
    const base: MarketDraft[] = t25
      ? footballMarkets({ odds1X2: [p1, pX, p2], oddsOU25: [t25.a, t25.b] })
      : [
          {
            type: "1X2",
            line: null,
            selections: [
              { code: "1", odds: p1 },
              { code: "X", odds: pX },
              { code: "2", odds: p2 },
            ],
          },
        ];
    // Bookmaker totals replace the model's for the same line.
    const quoted = new Set(totals.map((t) => t.line));
    return [
      ...base.filter((m) => !(m.type === "OU" && m.line !== null && quoted.has(m.line))),
      ...totals.map((t) => ({
        type: "OU",
        line: t.line,
        selections: [
          { code: "OVER", odds: t.a },
          { code: "UNDER", odds: t.b },
        ],
      })),
    ];
  }

  const [p1, p2] = [price(event.home_team), price(event.away_team)];
  if (!p1 || !p2) return [];
  const markets: MarketDraft[] = [
    {
      type: "ML",
      line: null,
      selections: [
        { code: "1", odds: p1 },
        { code: "2", odds: p2 },
      ],
    },
  ];
  const spread = lineMarkets(event, "spreads", marginPct)[0];
  if (spread)
    markets.push({
      type: "HCP",
      line: spread.line,
      selections: [
        { code: "HOME", odds: spread.a },
        { code: "AWAY", odds: spread.b },
      ],
    });
  const total = lineMarkets(event, "totals", marginPct)[0];
  if (total)
    markets.push({
      type: "OU",
      line: total.line,
      selections: [
        { code: "OVER", odds: total.a },
        { code: "UNDER", odds: total.b },
      ],
    });
  return markets;
}

/** Final or live score from a scores entry, or null when not started. */
export function scoreOf(s: ApiScore): { home: number; away: number } | null {
  if (!s.scores) return null;
  const home = Number(s.scores.find((x) => x.name === s.home_team)?.score);
  const away = Number(s.scores.find((x) => x.name === s.away_team)?.score);
  return Number.isInteger(home) && Number.isInteger(away) ? { home, away } : null;
}
