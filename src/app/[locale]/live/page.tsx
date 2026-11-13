"use client";

import React, { useState } from "react";
import { LiveSportsTracker } from "@/components/live/LiveSportsTracker";
import { LiveDealerStudio } from "@/components/live/LiveDealerStudio";
import { LiveWinsTicker } from "@/components/live/LiveWinsTicker";

export default function LiveArenaPage() {
  const [activeTab, setActiveTab] = useState<"SPORTS" | "CASINO">("SPORTS");

  return (
    <div className="space-y-6">
      {/* Top Live Wins Ticker */}
      <LiveWinsTicker />

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-red-500/30 bg-linear-to-r from-slate-950 via-slate-900 to-slate-950 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-500/50 bg-red-500/20 px-3 py-1 text-xs font-bold text-red-300">
              <span className="size-2 animate-ping rounded-full bg-red-500" />
              SPORTSBOOK PRO · EN VIVO / LIVE ARENA
            </div>
            <h1 className="font-display text-2xl sm:text-4xl font-black tracking-tight text-white">
              Acción en Tiempo Real <span className="bg-linear-to-r from-red-500 to-amber-400 bg-clip-text text-transparent">Minuto a Minuto</span>
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-2xl">
              Sigue partidos en juego con radar de posesión y cuotas que fluctúan en vivo, o ingresa a las mesas de casino con crupier y multijugador en tiempo real.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center rounded-2xl border border-slate-800 bg-slate-900/90 p-1.5 shadow-lg">
            <button
              type="button"
              onClick={() => setActiveTab("SPORTS")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition ${
                activeTab === "SPORTS"
                  ? "bg-linear-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>⚽</span>
              <span>Deportes En Vivo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("CASINO")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition ${
                activeTab === "CASINO"
                  ? "bg-linear-to-r from-red-500 to-rose-600 text-white shadow-md shadow-red-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>📹</span>
              <span>Casino con Crupier</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Tab View */}
      {activeTab === "SPORTS" ? (
        <section className="space-y-6">
          <LiveSportsTracker />
        </section>
      ) : (
        <section className="space-y-6">
          <LiveDealerStudio />
        </section>
      )}
    </div>
  );
}
