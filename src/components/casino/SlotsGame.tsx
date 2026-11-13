"use client";

import React, { useState } from "react";
import { useDemoWallet } from "./DemoWalletProvider";
import {
  SLOT_PAYLINES,
  SLOT_SYMBOLS,
  SlotSpinOutcome,
  SlotSymbol,
  spinSlots,
} from "@/lib/casino-engine";

export function SlotsGame() {
  const { balance, deductCredits, addCredits } = useDemoWallet();
  const [betPerLine, setBetPerLine] = useState<number>(5);
  const [isSpinning, setIsSpinning] = useState(false);
  const [outcome, setOutcome] = useState<SlotSpinOutcome | null>(null);
  const [winNotification, setWinNotification] = useState<string | null>(null);

  const numPaylines = SLOT_PAYLINES.length; // 5 lines
  const totalBet = betPerLine * numPaylines;

  // Initial display reels
  const [displayGrid, setDisplayGrid] = useState<SlotSymbol[][]>([
    ["7", "CROWN", "DIAMOND"],
    ["BELL", "GRAPES", "CHERRY"],
    ["WILD", "7", "CROWN"],
    ["DIAMOND", "BELL", "GRAPES"],
    ["CHERRY", "WILD", "7"],
  ]);

  const handleSpin = () => {
    if (isSpinning) return;
    if (balance < totalBet) {
      alert("Insufficient demo credits! Use the Demo Faucet above.");
      return;
    }

    if (!deductCredits(totalBet)) return;

    setIsSpinning(true);
    setWinNotification(null);

    // Simulate reel rotation timing
    setTimeout(() => {
      const result = spinSlots(betPerLine);
      setDisplayGrid(result.grid);
      setOutcome(result);

      if (result.totalPayout > 0) {
        addCredits(result.totalPayout);
        setWinNotification(`¡PREMIO MAYOR! +${result.totalPayout.toFixed(2)} (Multiplicador Total: ${result.totalMultiplier}x)`);
      } else {
        setWinNotification("¡Gira de nuevo para el Jackpot 777!");
      }

      setIsSpinning(false);
    }, 1500);
  };

  const getSymbolMeta = (sym: SlotSymbol) => {
    return SLOT_SYMBOLS.find((s) => s.id === sym) || SLOT_SYMBOLS[0];
  };

  return (
    <div className="mx-auto max-w-4xl rounded-3xl border border-amber-500/20 bg-slate-950 p-4 sm:p-6 shadow-2xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Golden 7s <span className="text-amber-400">Jackpot Slots</span>
            </h2>
            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              96.5% RTP
            </span>
          </div>
          <p className="text-xs text-slate-400">
            5 reels, 5 paylines. Match 3, 4, or 5 symbols consecutively from left to right. Golden Star is WILD.
          </p>
        </div>
      </div>

      {/* Slot Machine Cabinet Display */}
      <div className="mb-6 rounded-2xl border-4 border-amber-500/40 bg-linear-to-b from-slate-900 via-slate-950 to-slate-900 p-4 sm:p-6 shadow-[0_0_50px_rgba(245,158,11,0.15)]">
        {/* Reels container */}
        <div className="grid grid-cols-5 gap-2 sm:gap-3 rounded-xl border-2 border-slate-800 bg-slate-950 p-2 sm:p-4">
          {displayGrid.map((reelSymbols, reelIdx) => (
            <div
              key={reelIdx}
              className={`flex flex-col gap-2 rounded-lg bg-slate-900/90 p-1 sm:p-2 border border-slate-800 ${
                isSpinning ? "animate-pulse" : ""
              }`}
            >
              {reelSymbols.map((sym, rowIdx) => {
                const meta = getSymbolMeta(sym);
                const isWinningSlot = outcome?.winningLines.some((wl) => {
                  const coords = SLOT_PAYLINES[wl.lineIndex];
                  return coords.slice(0, wl.count).some(([r, row]) => r === reelIdx && row === rowIdx);
                });

                return (
                  <div
                    key={rowIdx}
                    className={`flex h-16 sm:h-24 flex-col items-center justify-center rounded-lg border text-center transition-all ${
                      isWinningSlot
                        ? "scale-105 border-amber-400 bg-amber-400/20 shadow-md shadow-amber-400/30"
                        : "border-slate-800 bg-slate-950"
                    }`}
                  >
                    <span className="text-2xl sm:text-4xl drop-shadow-md">{meta.icon}</span>
                    <span className="mt-1 text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                      {meta.name}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Win announcement Banner */}
        {winNotification && (
          <div
            className={`mt-4 rounded-xl px-4 py-2.5 text-center text-sm font-black transition ${
              outcome && outcome.totalPayout > 0
                ? "border border-amber-400 bg-amber-400/20 text-amber-300 animate-bounce"
                : "border border-slate-800 bg-slate-900 text-slate-400"
            }`}
          >
            {winNotification}
          </div>
        )}
      </div>

      {/* Paytable Preview Chips */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-2 text-xs">
        {SLOT_SYMBOLS.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-slate-300"
          >
            <span>{s.icon}</span>
            <span className="font-semibold">{s.name}:</span>
            <span className="font-mono font-bold text-amber-400">up to {s.multipliers[2]}x</span>
          </div>
        ))}
      </div>

      {/* Control Bar: Bet Per Line, Total Bet, Spin Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-4">
        {/* Bet per line selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Bet / Line:</span>
          {[2, 5, 10, 20, 50].map((amt) => (
            <button
              key={amt}
              type="button"
              disabled={isSpinning}
              onClick={() => setBetPerLine(amt)}
              className={`rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold transition ${
                betPerLine === amt
                  ? "border border-amber-400 bg-amber-400 text-slate-950"
                  : "border border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
              }`}
            >
              {amt}
            </button>
          ))}
        </div>

        {/* Total bet & Spin action */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase">5 Lines · Total Bet</div>
            <div className="font-mono text-sm font-bold text-amber-300">{totalBet}</div>
          </div>

          <button
            type="button"
            onClick={handleSpin}
            disabled={isSpinning}
            className="rounded-xl border border-amber-400 bg-linear-to-r from-amber-500 to-yellow-400 px-8 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-40 active:scale-95"
          >
            {isSpinning ? "SPINNING..." : "SPIN REELS"}
          </button>
        </div>
      </div>
    </div>
  );
}

