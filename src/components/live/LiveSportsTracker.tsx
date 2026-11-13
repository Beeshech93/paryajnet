"use client";

import React, { useEffect, useState } from "react";
import { useDemoWallet } from "../casino/DemoWalletProvider";

interface MatchEvent {
  minute: string;
  type: "GOAL" | "CARD" | "CORNER" | "ATTACK";
  text: string;
}

export function LiveSportsTracker() {
  const { deductCredits, addCredits, formattedBalance } = useDemoWallet();
  const [clockMinute, setClockMinute] = useState(68);
  const [homeScore, setHomeScore] = useState(2);
  const [awayScore, setAwayScore] = useState(1);
  const [activeMarket, setActiveMarket] = useState<"1X2" | "NEXT_GOAL" | "TOTAL_GOALS">("1X2");

  // Dynamic live odds state that fluctuates in real time
  const [odds, setOdds] = useState({
    home: 1.45,
    draw: 4.10,
    away: 7.20,
    nextHome: 1.85,
    noGoal: 3.50,
    nextAway: 3.80,
    over35: 2.15,
    under35: 1.65,
  });

  const [oddsFlashing, setOddsFlashing] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<MatchEvent[]>([
    { minute: "64'", type: "ATTACK", text: "Dangerous free kick for América saved by keeper" },
    { minute: "58'", type: "GOAL", text: "⚽ GOAL! Henry Martín (América) scores from header (2-1)" },
    { minute: "44'", type: "CARD", text: "🟨 Yellow Card for Érick Gutiérrez (Chivas)" },
    { minute: "32'", type: "GOAL", text: "⚽ GOAL! Roberto Alvarado (Chivas) equalizes (1-1)" },
    { minute: "14'", type: "GOAL", text: "⚽ GOAL! Diego Valdés (América) strikes outside box (1-0)" },
  ]);

  const [placedBetSuccess, setPlacedBetSuccess] = useState<string | null>(null);

  // Simulate in-play clock ticking and odds movement
  useEffect(() => {
    const interval = setInterval(() => {
      setClockMinute((prev) => (prev < 90 ? prev + 1 : 90));

      // 30% chance of odds micro-fluctuation
      if (Math.random() < 0.35) {
        const delta = (Math.random() - 0.48) * 0.08;
        setOdds((prev) => {
          const newHome = Math.max(1.10, Math.round((prev.home + delta) * 100) / 100);
          return { ...prev, home: newHome };
        });
        setOddsFlashing("home");
        setTimeout(() => setOddsFlashing(null), 1200);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const placeLiveBet = (selection: string, oddVal: number) => {
    const stake = 100;
    if (!deductCredits(stake)) {
      alert("Saldo insuficiente. Recarga en la barra superior.");
      return;
    }

    setPlacedBetSuccess(`Apuesta en Vivo Confirmada: 100 en ${selection} @ ${oddVal.toFixed(2)} (Potencial: ${(stake * oddVal).toFixed(2)})`);
    setTimeout(() => setPlacedBetSuccess(null), 4000);
  };

  return (
    <div className="rounded-3xl border border-amber-500/20 bg-slate-950 p-4 sm:p-6 shadow-2xl">
      {/* Top Banner: League, Teams, Live Beacon */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-red-500/50 bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-400">
            <span className="size-2 animate-ping rounded-full bg-red-500" />
            EN VIVO · 2T {clockMinute}&apos;
          </span>
          <span className="text-xs font-semibold text-slate-400">Liga MX · Estadio Azteca, CDMX</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-mono text-slate-300">
            TV: TUDN / Univision
          </span>
        </div>
      </div>

      {/* Main Scoreboard & Dynamic Pitch Visual */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Pitch & Scoreboard Column (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-slate-800 bg-linear-to-b from-slate-900 to-slate-950 p-4 sm:p-6">
          {/* Teams and Score Header */}
          <div className="flex items-center justify-between">
            {/* Home Team */}
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-400/20 text-2xl font-black text-amber-300 border border-amber-400/30">
                🦅
              </div>
              <div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-white">Club América</h3>
                <span className="text-xs font-semibold text-emerald-400">Home · Attacking</span>
              </div>
            </div>

            {/* Central Live Score */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 font-mono text-3xl sm:text-4xl font-black text-amber-400">
                <span>{homeScore}</span>
                <span className="text-slate-600">:</span>
                <span>{awayScore}</span>
              </div>
              <span className="text-xs font-mono font-bold text-red-400">{clockMinute}&apos; LIVE</span>
            </div>

            {/* Away Team */}
            <div className="flex items-center gap-3 text-right">
              <div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-white">Chivas</h3>
                <span className="text-xs font-semibold text-slate-400">Away</span>
              </div>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-red-600/20 text-2xl font-black text-red-400 border border-red-500/30">
                🐐
              </div>
            </div>
          </div>

          {/* 2D Mini Pitch Radar Visualization */}
          <div className="relative my-6 h-36 w-full overflow-hidden rounded-xl border border-emerald-900/60 bg-linear-to-r from-emerald-950/80 via-emerald-900/40 to-emerald-950/80 p-3 shadow-inner">
            {/* Center line & circle */}
            <div className="absolute inset-y-0 left-1/2 w-0.5 bg-emerald-600/30" />
            <div className="absolute top-1/2 left-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-600/30" />
            {/* Penalty boxes */}
            <div className="absolute inset-y-6 left-0 w-12 rounded-r-lg border border-l-0 border-emerald-600/30" />
            <div className="absolute inset-y-6 right-0 w-12 rounded-l-lg border border-r-0 border-emerald-600/30" />

            {/* Animated ball & active pressure zone */}
            <div className="absolute top-1/2 left-[65%] -translate-y-1/2 flex items-center gap-1.5 animate-pulse">
              <span className="size-3.5 rounded-full bg-white shadow-md shadow-white/80" />
              <span className="rounded bg-amber-400/90 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
                América in final third
              </span>
            </div>

            {/* Pitch status bar bottom */}
            <div className="absolute bottom-2 inset-x-4 flex justify-between text-[10px] font-semibold text-emerald-400/80">
              <span>Possession: 58%</span>
              <span>Dangerous Attacks: 14 vs 9</span>
              <span>Shots on target: 6 vs 3</span>
            </div>
          </div>

          {/* Live In-Play Event Timeline */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Match Incident Log</div>
            <div className="max-h-28 overflow-y-auto space-y-1 pr-1 text-xs">
              {recentEvents.map((ev, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-900/80 px-2.5 py-1 text-slate-300">
                  <span className="font-mono font-bold text-amber-400">{ev.minute}</span>
                  <span className="truncate">{ev.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live In-Play Betting Board Column (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Mercados En Vivo (In-Play Odds)
              </span>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                Apuesta Rápida
              </span>
            </div>

            {/* Market Tabs */}
            <div className="mb-4 flex gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveMarket("1X2")}
                className={`flex-1 rounded-lg py-1.5 font-bold transition ${
                  activeMarket === "1X2" ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                1X2
              </button>
              <button
                type="button"
                onClick={() => setActiveMarket("NEXT_GOAL")}
                className={`flex-1 rounded-lg py-1.5 font-bold transition ${
                  activeMarket === "NEXT_GOAL" ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                Próximo Gol
              </button>
              <button
                type="button"
                onClick={() => setActiveMarket("TOTAL_GOALS")}
                className={`flex-1 rounded-lg py-1.5 font-bold transition ${
                  activeMarket === "TOTAL_GOALS" ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                Total (+/- 3.5)
              </button>
            </div>

            {/* Odds Selectors */}
            {activeMarket === "1X2" && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => placeLiveBet("Club América (Gana Local)", odds.home)}
                  className={`flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 transition hover:border-amber-400 ${
                    oddsFlashing === "home" ? "ring-2 ring-emerald-400 bg-emerald-950/40" : ""
                  }`}
                >
                  <span className="font-semibold text-slate-200">1 · Club América</span>
                  <span className="font-mono text-base font-bold text-amber-400">{odds.home.toFixed(2)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => placeLiveBet("Empate", odds.draw)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 transition hover:border-amber-400"
                >
                  <span className="font-semibold text-slate-200">X · Empate</span>
                  <span className="font-mono text-base font-bold text-amber-400">{odds.draw.toFixed(2)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => placeLiveBet("Chivas (Gana Visitante)", odds.away)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 transition hover:border-amber-400"
                >
                  <span className="font-semibold text-slate-200">2 · Chivas</span>
                  <span className="font-mono text-base font-bold text-amber-400">{odds.away.toFixed(2)}</span>
                </button>
              </div>
            )}

            {activeMarket === "NEXT_GOAL" && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => placeLiveBet("Próximo Gol: América", odds.nextHome)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 transition hover:border-amber-400"
                >
                  <span className="font-semibold text-slate-200">Gol 4 · América</span>
                  <span className="font-mono text-base font-bold text-amber-400">{odds.nextHome.toFixed(2)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => placeLiveBet("Sin Más Goles", odds.noGoal)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 transition hover:border-amber-400"
                >
                  <span className="font-semibold text-slate-200">Sin Más Goles</span>
                  <span className="font-mono text-base font-bold text-amber-400">{odds.noGoal.toFixed(2)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => placeLiveBet("Próximo Gol: Chivas", odds.nextAway)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 transition hover:border-amber-400"
                >
                  <span className="font-semibold text-slate-200">Gol 4 · Chivas</span>
                  <span className="font-mono text-base font-bold text-amber-400">{odds.nextAway.toFixed(2)}</span>
                </button>
              </div>
            )}

            {activeMarket === "TOTAL_GOALS" && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => placeLiveBet("Más de 3.5 Goles", odds.over35)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 transition hover:border-amber-400"
                >
                  <span className="font-semibold text-slate-200">Over (+3.5)</span>
                  <span className="font-mono text-base font-bold text-amber-400">{odds.over35.toFixed(2)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => placeLiveBet("Menos de 3.5 Goles", odds.under35)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 transition hover:border-amber-400"
                >
                  <span className="font-semibold text-slate-200">Under (-3.5)</span>
                  <span className="font-mono text-base font-bold text-amber-400">{odds.under35.toFixed(2)}</span>
                </button>
              </div>
            )}

            {/* Notification alert on bet placed */}
            {placedBetSuccess && (
              <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-2.5 text-center text-xs font-bold text-emerald-300 animate-fade-in">
                {placedBetSuccess}
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-slate-800 pt-3 text-[11px] text-slate-400">
            Haz clic en cualquier cuota para colocar una apuesta en vivo inmediata de 100 créditos.
          </div>
        </div>
      </div>
    </div>
  );
}

