"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { placeBetAction } from "@/app/actions/play";
import { FormMessage } from "@/components/ActionForm";
import { LocalTime } from "@/components/LocalTime";
import { formatMoneyClient, formatNumber } from "@/lib/locale-tags";
import type { ActionResult } from "@/lib/types";

export type BoardEvent = {
  id: string;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startsAt: string;
  markets: {
    id: string;
    type: string;
    status: string;
    selections: { id: string; code: string; odds: string }[];
  }[];
};

type Leg = { eventId: string; selectionId: string; odds: string; label: string; match: string };

export function SportsBoard({
  events,
  currency,
  limits,
  signedIn,
}: {
  events: BoardEvent[];
  currency: string;
  limits: { min: number; max: number };
  signedIn: boolean;
}) {
  const t = useTranslations("sports");
  const locale = useLocale();
  const router = useRouter();
  const [sport, setSport] = useState<string>("all");
  const [slip, setSlip] = useState<Leg[]>([]);
  const [stake, setStake] = useState<string>(String(limits.min * 10));
  const [result, setResult] = useState<ActionResult<unknown> | null>(null);
  const [pending, start] = useTransition();

  const sports = useMemo(() => Array.from(new Set(events.map((e) => e.sport))), [events]);
  const visible = events.filter((e) => sport === "all" || e.sport === sport);
  const leagues = useMemo(() => {
    const map = new Map<string, BoardEvent[]>();
    for (const e of visible) map.set(e.league, [...(map.get(e.league) ?? []), e]);
    return Array.from(map);
  }, [visible]);

  function selectionLabel(e: BoardEvent, type: string, code: string) {
    if (type === "1X2") return code === "1" ? e.homeTeam : code === "2" ? e.awayTeam : t("draw");
    return `${t(`markets.${type}`)} · ${t(`codes.${code}`)}`;
  }

  function toggle(e: BoardEvent, type: string, sel: { id: string; code: string; odds: string }) {
    setResult(null);
    setSlip((current) => {
      if (current.some((l) => l.selectionId === sel.id)) return current.filter((l) => l.selectionId !== sel.id);
      const leg: Leg = {
        eventId: e.id,
        selectionId: sel.id,
        odds: sel.odds,
        label: selectionLabel(e, type, sel.code),
        match: `${e.homeTeam} — ${e.awayTeam}`,
      };
      // One leg per event: picking another outcome of the same match replaces it.
      return [...current.filter((l) => l.eventId !== e.id), leg];
    });
  }

  const totalOdds = slip.reduce((acc, l) => acc * Number(l.odds), 1);
  const stakeNum = Number(stake.replace(",", "."));
  const potential = Number.isFinite(stakeNum)
    ? Math.floor(((stakeNum * Math.floor(totalOdds * 100)) / 100) * 100) / 100
    : 0;

  function submit() {
    start(async () => {
      const res = await placeBetAction({
        stake: stake.replace(",", "."),
        legs: slip.map((l) => ({ selectionId: l.selectionId, odds: l.odds })),
      });
      setResult(res);
      if (res.ok) setSlip([]);
      if (!res.ok && (res.error === "odds_changed" || res.error === "selection_unavailable")) router.refresh();
    });
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        {sports.length > 1 && (
          <div className="flex gap-2">
            {["all", ...sports].map((s) => (
              <button
                key={s}
                onClick={() => setSport(s)}
                className={`chip border px-3 py-1.5 ${sport === s ? "border-brand bg-brand text-brand-ink" : "border-line text-muted"}`}
              >
                {s === "all" ? t("allSports") : t.has(`sportNames.${s}`) ? t(`sportNames.${s}`) : s}
              </button>
            ))}
          </div>
        )}

        {leagues.length === 0 && <p className="card p-8 text-center text-muted">{t("noEvents")}</p>}

        {leagues.map(([league, list]) => (
          <section key={league}>
            <h2 className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">{league}</h2>
            <div className="space-y-2">
              {list.map((e) => (
                <article key={e.id} className="card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">
                      {e.homeTeam} <span className="text-muted">vs</span> {e.awayTeam}
                    </p>
                    <p className="text-xs text-muted">
                      <LocalTime value={e.startsAt} />
                    </p>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-[3fr_2fr_2fr]">
                    {e.markets.map((m) => (
                      <div key={m.id}>
                        <p className="mb-1 text-[11px] font-medium text-muted uppercase">{t(`markets.${m.type}`)}</p>
                        <div className="flex gap-1.5">
                          {m.selections.map((s) => {
                            const active = slip.some((l) => l.selectionId === s.id);
                            return (
                              <button
                                key={s.id}
                                disabled={m.status !== "OPEN"}
                                data-active={active}
                                onClick={() => toggle(e, m.type, s)}
                                className="odds-btn disabled:opacity-40"
                              >
                                <span className="text-[11px] opacity-70">{t(`codes.${s.code}`)}</span>
                                <span className="font-bold tabular-nums">{formatNumber(s.odds, locale)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">{t("slip")}</h2>
            {slip.length > 0 && (
              <button onClick={() => setSlip([])} className="text-xs text-muted hover:text-danger">
                {t("clear")}
              </button>
            )}
          </div>
          <p className="text-xs text-muted">
            {slip.length === 0
              ? t("slipEmpty")
              : slip.length === 1
                ? t("single")
                : t("multiple", { count: slip.length })}
          </p>

          <ul className="mt-3 space-y-2">
            {slip.map((l) => (
              <li key={l.selectionId} className="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{l.label}</p>
                  <p className="truncate text-xs text-muted">{l.match}</p>
                </div>
                <span className="font-bold text-gold tabular-nums">{formatNumber(l.odds, locale)}</span>
                <button
                  aria-label={t("remove")}
                  onClick={() => setSlip((s) => s.filter((x) => x.selectionId !== l.selectionId))}
                  className="text-muted hover:text-danger"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {slip.length > 0 && (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted">{t("totalOdds")}</span>
                <span className="font-bold tabular-nums">
                  {formatNumber(Math.floor(totalOdds * 100) / 100, locale)}
                </span>
              </div>
              <div>
                <label className="label" htmlFor="stake">
                  {t("stake")} ({currency})
                </label>
                <input
                  id="stake"
                  inputMode="decimal"
                  className="input text-right font-bold tabular-nums"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-muted">
                  {t("limits", {
                    min: formatMoneyClient(limits.min, currency, locale),
                    max: formatMoneyClient(limits.max, currency, locale),
                  })}
                </p>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">{t("potentialWin")}</span>
                <span className="font-bold text-brand tabular-nums">
                  {formatMoneyClient(potential, currency, locale)}
                </span>
              </div>
              {signedIn ? (
                <button onClick={submit} disabled={pending} className="btn-primary w-full">
                  {pending ? "…" : t("placeBet")}
                </button>
              ) : (
                <Link href="/login" className="btn-primary w-full">
                  {t("loginToBet")}
                </Link>
              )}
            </div>
          )}
          <FormMessage state={result} success={t("placed")} />
        </div>
      </aside>
    </div>
  );
}
