/** Human labels for markets and selections, shared by server and client components. */

type T = (key: string, values?: Record<string, string | number>) => string;

export function formatLine(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export function marketLabel(t: T, sport: string, m: { type: string; line: number | null }): string {
  if (m.type === "OU") return t(sport === "basketball" ? "markets.OU_points" : "markets.OU", { line: m.line ?? 0 });
  if (m.type === "HCP") return t("markets.HCP");
  return t(`markets.${m.type}`);
}

/** Short label shown on an odds button. */
export function codeLabel(
  t: T,
  e: { homeTeam: string; awayTeam: string },
  m: { type: string; line: number | null },
  code: string,
) {
  if (m.type === "HCP") return `${code === "HOME" ? "1" : "2"} ${formatLine(code === "HOME" ? m.line! : -m.line!)}`;
  if (m.type === "CS") return code === "OTHER" ? t("codes.OTHER") : code;
  return t(`codes.${code}`);
}

/** Full label of a pick, for the bet slip and bet history. */
export function pickLabel(
  t: T,
  e: { sport: string; homeTeam: string; awayTeam: string },
  m: { type: string; line: number | null },
  code: string,
): string {
  if ((m.type === "1X2" || m.type === "ML") && code !== "X") return code === "1" ? e.homeTeam : e.awayTeam;
  if (m.type === "1X2") return t("draw");
  if (m.type === "HCP")
    return code === "HOME" ? `${e.homeTeam} ${formatLine(m.line!)}` : `${e.awayTeam} ${formatLine(-m.line!)}`;
  const value = m.type === "CS" ? (code === "OTHER" ? t("codes.OTHER") : code) : t(`codes.${code}`);
  return `${marketLabel(t, e.sport, m)} · ${value}`;
}

/** Markets shown on the event card before "more markets" is expanded. */
export function isMainMarket(sport: string, m: { type: string; line: number | null }): boolean {
  if (sport === "basketball") return true;
  return m.type === "1X2" || m.type === "BTTS" || (m.type === "OU" && m.line === 2.5);
}
