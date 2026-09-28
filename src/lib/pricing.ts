/**
 * Football pricing from a Poisson goals model.
 *
 * Given 1X2 and over/under 2.5 prices, we fit expected goals for each side
 * and derive the remaining markets (double chance, other totals, handicaps,
 * both teams to score, correct score) with a bookmaker margin.
 */

export type MarketDraft = { type: string; line: number | null; selections: { code: string; odds: number }[] };

const MAX_GOALS = 10;

function poisson(lambda: number): number[] {
  const p = [Math.exp(-lambda)];
  for (let k = 1; k <= MAX_GOALS; k++) p.push((p[k - 1] * lambda) / k);
  return p;
}

/** Probability matrix m[h][a] of the final score. */
export function scoreMatrix(lh: number, la: number): number[][] {
  const ph = poisson(lh);
  const pa = poisson(la);
  return ph.map((x) => pa.map((y) => x * y));
}

function sum(m: number[][], pred: (h: number, a: number) => boolean): number {
  let total = 0;
  for (let h = 0; h <= MAX_GOALS; h++) for (let a = 0; a <= MAX_GOALS; a++) if (pred(h, a)) total += m[h][a];
  return total;
}

/** Remove the margin from a set of prices: implied probabilities normalised to 1. */
export function fairProbabilities(odds: number[]): number[] {
  const implied = odds.map((o) => 1 / o);
  const total = implied.reduce((a, b) => a + b, 0);
  return implied.map((p) => p / total);
}

/** Fit expected goals (home, away) to target home-win, away-win and over-2.5 probabilities. */
export function fitGoals(pHome: number, pAway: number, pOver25: number): { lh: number; la: number } {
  let best = { lh: 1.4, la: 1.1, err: Infinity };
  for (let lh = 0.2; lh <= 4; lh += 0.02) {
    for (let la = 0.2; la <= 4; la += 0.02) {
      const m = scoreMatrix(lh, la);
      const err =
        (sum(m, (h, a) => h > a) - pHome) ** 2 +
        (sum(m, (h, a) => h < a) - pAway) ** 2 +
        (sum(m, (h, a) => h + a > 2.5) - pOver25) ** 2;
      if (err < best.err) best = { lh, la, err };
    }
  }
  return { lh: best.lh, la: best.la };
}

function price(p: number, margin: number): number {
  if (p <= 0) return 500;
  const odds = 1 / (p * (1 + margin));
  return Math.min(500, Math.max(1.01, Math.floor(odds * 100) / 100));
}

const CS_SCORES = [
  "1-0",
  "2-0",
  "2-1",
  "3-0",
  "3-1",
  "3-2",
  "0-0",
  "1-1",
  "2-2",
  "3-3",
  "0-1",
  "0-2",
  "1-2",
  "0-3",
  "1-3",
  "2-3",
];

/** Build the full football market set. The given 1X2 / OU 2.5 prices are kept as entered. */
export function footballMarkets(input: {
  odds1X2: [number, number, number];
  oddsOU25: [number, number];
  oddsBTTS?: [number, number];
  margin?: number;
}): MarketDraft[] {
  const margin = input.margin ?? 0.06;
  const [pH, , pA] = fairProbabilities(input.odds1X2);
  const [pOver] = fairProbabilities(input.oddsOU25);
  const { lh, la } = fitGoals(pH, pA, pOver);
  const m = scoreMatrix(lh, la);
  const p = (pred: (h: number, a: number) => boolean) => sum(m, pred);
  const two = (a: number, b: number, c1: string, c2: string, mg = margin) => [
    { code: c1, odds: price(a / (a + b), mg) },
    { code: c2, odds: price(b / (a + b), mg) },
  ];

  const [o1, oX, o2] = input.odds1X2;
  const markets: MarketDraft[] = [
    {
      type: "1X2",
      line: null,
      selections: [
        { code: "1", odds: o1 },
        { code: "X", odds: oX },
        { code: "2", odds: o2 },
      ],
    },
    {
      type: "DC",
      line: null,
      selections: [
        {
          code: "1X",
          odds: price(
            p((h, a) => h >= a),
            margin,
          ),
        },
        {
          code: "12",
          odds: price(
            p((h, a) => h !== a),
            margin,
          ),
        },
        {
          code: "X2",
          odds: price(
            p((h, a) => h <= a),
            margin,
          ),
        },
      ],
    },
  ];

  for (const line of [1.5, 2.5, 3.5]) {
    markets.push({
      type: "OU",
      line,
      selections:
        line === 2.5
          ? [
              { code: "OVER", odds: input.oddsOU25[0] },
              { code: "UNDER", odds: input.oddsOU25[1] },
            ]
          : two(
              p((h, a) => h + a > line),
              p((h, a) => h + a < line),
              "OVER",
              "UNDER",
            ),
    });
  }

  markets.push({
    type: "BTTS",
    line: null,
    selections: input.oddsBTTS
      ? [
          { code: "YES", odds: input.oddsBTTS[0] },
          { code: "NO", odds: input.oddsBTTS[1] },
        ]
      : two(
          p((h, a) => h > 0 && a > 0),
          p((h, a) => h === 0 || a === 0),
          "YES",
          "NO",
        ),
  });

  for (const line of [-1.5, 1.5]) {
    markets.push({
      type: "HCP",
      line,
      selections: two(
        p((h, a) => h + line > a),
        p((h, a) => h + line < a),
        "HOME",
        "AWAY",
      ),
    });
  }

  const csMargin = 0.15;
  const listed = new Set(CS_SCORES);
  markets.push({
    type: "CS",
    line: null,
    selections: [
      ...CS_SCORES.map((s) => {
        const [h, a] = s.split("-").map(Number);
        return { code: s, odds: price(m[h][a], csMargin) };
      }),
      {
        code: "OTHER",
        odds: price(
          p((h, a) => !listed.has(`${h}-${a}`)),
          csMargin,
        ),
      },
    ],
  });

  return markets;
}

/** Basketball: moneyline, point spread and total, priced as entered. */
export function basketballMarkets(input: {
  oddsML: [number, number];
  spread: number;
  total: number;
  oddsSpread?: [number, number];
  oddsTotal?: [number, number];
}): MarketDraft[] {
  const [sh, sa] = input.oddsSpread ?? [1.9, 1.9];
  const [to, tu] = input.oddsTotal ?? [1.9, 1.9];
  return [
    {
      type: "ML",
      line: null,
      selections: [
        { code: "1", odds: input.oddsML[0] },
        { code: "2", odds: input.oddsML[1] },
      ],
    },
    {
      type: "HCP",
      line: input.spread,
      selections: [
        { code: "HOME", odds: sh },
        { code: "AWAY", odds: sa },
      ],
    },
    {
      type: "OU",
      line: input.total,
      selections: [
        { code: "OVER", odds: to },
        { code: "UNDER", odds: tu },
      ],
    },
  ];
}
