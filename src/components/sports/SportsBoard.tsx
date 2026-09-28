"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { placeBetAction } from "@/app/actions/play";
import { FormMessage } from "@/components/ActionForm";
import { LocalTime } from "@/components/LocalTime";
import { codeLabel, isMainMarket, marketLabel, pickLabel } from "@/lib/labels";
import { formatMoneyClient, formatNumber } from "@/lib/locale-tags";
import type { ActionResult } from "@/lib/types";

export type BoardMarket = {
  id: string;
  type: string;
  line: number | null;
  status: string;
  selections: { id: string; code: string; odds: string }[];
};

export type BoardEvent = {
  id: string;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startsAt: string;
  status: string;
  clock: string | null;
  homeScore: number | null;
  awayScore: number | null;
  markets: BoardMarket[];
};

type Leg = { eventId: string; selectionId: string; odds: string; label: string; match: string; live: boolean };

export function SportsBoard({
  events,
  currency,
  limits,
  signedIn,
  liveDelaySeconds,
}: {
  events: BoardEvent[];
  currency: string;
  limits: { min: number; max: number };
  signedIn: boolean;
  liveDelaySeconds: number;
}) {
  const t = useTranslations("sports");
  const tr = (k: string, v?: Record<string, string | number>) => t(k, v);
  const locale = useLocale();
  const router = useRouter();
  const [sport, setSport] = useState<string>("all");
  const [slip, setSlip] = useState<Leg[]>([]);
  const [stake, setStake] = useState<string>(String(limits.min * 10));
  const [result, setResult] = useState<ActionResult<unknown> | null>(null);
  const [pending, start] = useTransition();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const hasLive = events.some((e) => e.status === "LIVE");

  // Keep odds, scores and suspensions fresh: every 5s with live games, else every 30s.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), hasLive ? 5000 : 30000);
    return () => clearInterval(id);
  }, [hasLive, router]);

  // Current state of every selection on the board, to detect changes in the slip.
  const current = useMemo(() => {
    const map = new Map<string, { odds: string; open: boolean }>();
    for (const e of events)
      for (const m of e.markets)
        for (const s of m.selections) map.set(s.id, { odds: s.odds, open: m.status === "OPEN" });
    return map;
  }, [events]);

  const sports = useMemo(() => Array.from(new Set(events.map((e) => e.sport))), [events]);
  const visible = events.filter((e) => sport === "all" || e.sport === sport);
  const live = visible.filter((e) => e.status === "LIVE");
  const leagues = useMemo(() => {
    const map = new Map<string, BoardEvent[]>();
    for (const e of visible.filter((x) => x.status !== "LIVE")) map.set(e.league, [...(map.get(e.league) ?? []), e]);
    return Array.from(map);
  }, [visible]);

  function toggle(e: BoardEvent, m: BoardMarket, sel: { id: string; code: string; odds: string }) {
    setResult(null);
    setSlip((cur) => {
      if (cur.some((l) => l.selectionId === sel.id)) return cur.filter((l) => l.selectionId !== sel.id);
      const leg: Leg = {
        eventId: e.id,
        selectionId: sel.id,
        odds: sel.odds,
        label: pickLabel(tr, e, m, sel.code),
        match: `${e.homeTeam} — ${e.awayTeam}`,
        live: e.status === "LIVE",
      };
      // One leg per event: picking another outcome of the same match replaces it.
      return [...cur.filter((l) => l.eventId !== e.id), leg];
    });
  }

  const legState = slip.map((l) => {
    const now = current.get(l.selectionId);
    return { ...l, unavailable: !now || !now.open, newOdds: now && now.odds !== l.odds ? now.odds : null };
  });
  const changed = legState.some((l) => l.newOdds);
  const unavailable = legState.some((l) => l.unavailable);

  const totalOdds = Math.floor(slip.reduce((acc, l) => acc * Number(l.odds), 1) * 100) / 100;
  const stakeNum = Number(stake.replace(",", "."));
  const potential = Number.isFinite(stakeNum) ? Math.floor(stakeNum * totalOdds * 100) / 100 : 0;

  function acceptChanges() {
    setSlip((cur) =>
      cur
        .filter((l) => current.get(l.selectionId)?.open)
        .map((l) => ({ ...l, odds: current.get(l.selectionId)!.odds })),
    );
  }

  function submit() {
    start(async () => {
      const res = await placeBetAction({
        stake: stake.replace(",", "."),
        legs: slip.map((l) => ({ selectionId: l.selectionId, odds: l.odds })),
      });
      setResult(res);
      if (res.ok) setSlip([]);
      router.refresh();
    });
  }

  function EventCard({ e }: { e: BoardEvent }) {
    const main = e.markets.filter((m) => isMainMarket(e.sport, m));
    const extra = e.markets.filter((m) => !isMainMarket(e.sport, m));
    const open = expanded[e.id];
    const isLive = e.status === "LIVE";
    return (
      <article className={`card p-4 ${isLive ? "border-danger/40" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">
            {e.homeTeam} <span className="text-muted">vs</span> {e.awayTeam}
          </p>
          {isLive ? (
            <p className="flex items-center gap-2 text-sm">
              <span className="chip animate-pulse bg-danger text-white">{t("live")}</span>
              <span className="font-display text-lg font-bold tabular-nums">
                {e.homeScore} - {e.awayScore}
              </span>
              {e.clock && <span className="text-xs text-muted tabular-nums">{e.clock}</span>}
            </p>
          ) : (
            <p className="text-xs text-muted">
              <LocalTime value={e.startsAt} />
            </p>
          )}
        </div>
        <MarketGrid e={e} markets={main} />
        {extra.length > 0 && (
          <>
            {open && <MarketGrid e={e} markets={extra} />}
            <button
              onClick={() => setExpanded((x) => ({ ...x, [e.id]: !open }))}
              className="mt-3 text-xs font-semibold text-brand-strong"
            >
              {open ? t("fewerMarkets") : t("moreMarkets", { count: extra.length })}
            </button>
          </>
        )}
      </article>
    );
  }

  function MarketGrid({ e, markets }: { e: BoardEvent; markets: BoardMarket[] }) {
    return (
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {markets.map((m) => (
          <div key={m.id} className={m.type === "CS" ? "md:col-span-3" : ""}>
            <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-muted uppercase">
              {marketLabel(tr, e.sport, m)}
              {m.status !== "OPEN" && <span aria-label={t("suspended")}>🔒</span>}
            </p>
            <div
              className={m.type === "CS" ? "grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-9" : "flex gap-1.5"}
            >
              {m.selections.map((s) => {
                const active = slip.some((l) => l.selectionId === s.id);
                return (
                  <button
                    key={s.id}
                    disabled={m.status !== "OPEN"}
                    data-active={active}
                    onClick={() => toggle(e, m, s)}
                    className="odds-btn disabled:opacity-40"
                  >
                    <span className="truncate text-[11px] opacity-70">{codeLabel(tr, e, m, s.code)}</span>
                    <span className="font-bold tabular-nums">{formatNumber(s.odds, locale)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
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

        {live.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wider text-danger uppercase">
              <span className="size-2 animate-pulse rounded-full bg-danger" /> {t("liveNow")}
            </h2>
            <div className="space-y-2">
              {live.map((e) => (
                <EventCard key={e.id} e={e} />
              ))}
            </div>
          </section>
        )}

        {leagues.length === 0 && live.length === 0 && (
          <p className="card p-8 text-center text-muted">{t("noEvents")}</p>
        )}

        {leagues.map(([league, list]) => (
          <section key={league}>
            <h2 className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">{league}</h2>
            <div className="space-y-2">
              {list.map((e) => (
                <EventCard key={e.id} e={e} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {slip.length > 0 && (
        <a
          href="#slip"
          className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-between rounded-2xl bg-ink px-5 py-3.5 text-white shadow-pop lg:hidden"
        >
          <span className="flex items-center gap-2 font-semibold">
            <span className="flex size-6 items-center justify-center rounded-full bg-danger text-xs font-bold">
              {slip.length}
            </span>
            {t("slip")}
          </span>
          <span className="rounded-lg bg-gold px-2 py-0.5 font-bold text-ink tabular-nums">
            {formatNumber(totalOdds, locale)}
          </span>
        </a>
      )}

      <aside id="slip" className="scroll-mt-24 pb-20 lg:sticky lg:top-20 lg:self-start lg:pb-0">
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
            {legState.map((l) => (
              <li
                key={l.selectionId}
                className={`flex items-start gap-2 rounded-xl p-3 text-sm ${l.unavailable ? "bg-danger/10" : "bg-surface-2"}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {l.live && <span className="mr-1 text-[10px] font-bold text-danger">{t("live")}</span>}
                    {l.label}
                  </p>
                  <p className="truncate text-xs text-muted">{l.match}</p>
                  {l.unavailable && <p className="text-xs text-danger">{t("suspended")}</p>}
                </div>
                <span className="text-right font-bold tabular-nums">
                  {l.newOdds ? (
                    <>
                      <span className="block text-xs text-muted line-through">{formatNumber(l.odds, locale)}</span>
                      <span className={Number(l.newOdds) > Number(l.odds) ? "text-brand-strong" : "text-danger"}>
                        {formatNumber(l.newOdds, locale)}
                      </span>
                    </>
                  ) : (
                    <span className="rounded-md bg-gold px-1.5 py-0.5 text-ink">{formatNumber(l.odds, locale)}</span>
                  )}
                </span>
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
                <span className="font-bold tabular-nums">{formatNumber(totalOdds, locale)}</span>
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
                <span className="font-bold text-brand-strong tabular-nums">
                  {formatMoneyClient(potential, currency, locale)}
                </span>
              </div>
              {slip.some((l) => l.live) && (
                <p className="text-[11px] text-muted">{t("liveDelay", { seconds: liveDelaySeconds })}</p>
              )}
              {!signedIn ? (
                <Link href="/login" className="btn-primary w-full">
                  {t("loginToBet")}
                </Link>
              ) : changed || unavailable ? (
                <button onClick={acceptChanges} className="btn-gold w-full py-3">
                  {t("acceptChanges")}
                </button>
              ) : (
                <button onClick={submit} disabled={pending} className="btn-accent w-full py-3 text-base">
                  {pending ? t("placing") : t("placeBet")}
                </button>
              )}
            </div>
          )}
          <FormMessage state={result} success={t("placed")} />
        </div>
      </aside>
    </div>
  );
}
