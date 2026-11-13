"use client";

import React, { useEffect, useState } from "react";

interface LiveWin {
  id: string;
  flag: string;
  player: string;
  game: string;
  amount: string;
  multiplier?: string;
}

const SAMPLE_WINS: LiveWin[] = [
  { id: "1", flag: "🇲🇽", player: "Carlos M.", game: "Liga MX (América vs Chivas)", amount: "MX$ 1,450.00", multiplier: "2.90x" },
  { id: "2", flag: "🇭🇹", player: "Jean-Baptiste P.", game: "Woulèt an Dirèk (17 Nwa)", amount: "G 3,500.00", multiplier: "35:1" },
  { id: "3", flag: "🇲🇽", player: "Sofía D.", game: "Crash Aviator", amount: "MX$ 2,820.00", multiplier: "9.40x" },
  { id: "4", flag: "🇭🇹", player: "Wilner T.", game: "Blackjack Pro (Natural 3:2)", amount: "G 1,250.00", multiplier: "2.5x" },
  { id: "5", flag: "🇲🇽", player: "Diego R.", game: "Golden 7s Jackpot Slots", amount: "MX$ 5,000.00", multiplier: "250x" },
  { id: "6", flag: "🇭🇹", player: "Fritzner D.", game: "Bòlèt New York (Lot 1)", amount: "G 2,500.00", multiplier: "50x" },
];

export function LiveWinsTicker() {
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % SAMPLE_WINS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const win = SAMPLE_WINS[currentIdx];

  return (
    <div className="flex items-center gap-2 overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-300">
      <span className="flex size-2 items-center justify-center">
        <span className="size-2 animate-ping rounded-full bg-emerald-400" />
      </span>
      <span className="font-bold text-white uppercase tracking-wider text-[10px]">LIVE DEMO WIN:</span>
      <div className="flex items-center gap-1.5 truncate">
        <span>{win.flag}</span>
        <span className="font-semibold text-slate-200">{win.player}</span>
        <span className="text-slate-400">won</span>
        <span className="font-bold font-mono text-amber-300">{win.amount}</span>
        <span className="hidden text-slate-400 sm:inline">in {win.game}</span>
        <span className="rounded bg-emerald-500/20 px-1 py-0.2 font-mono text-[10px] font-bold text-emerald-400">
          {win.multiplier}
        </span>
      </div>
    </div>
  );
}
