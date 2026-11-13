"use client";

import React, { useState } from "react";
import { useDemoWallet } from "./DemoWalletProvider";
import {
  calculateRoulettePayout,
  ROULETTE_RED_NUMBERS,
  RouletteBet,
  RouletteSpinResult,
  spinRoulette,
} from "@/lib/casino-engine";

const CHIP_VALUES = [5, 10, 25, 50, 100, 500];

export function RouletteGame() {
  const { balance, deductCredits, addCredits, formattedBalance } = useDemoWallet();
  const [selectedChip, setSelectedChip] = useState<number>(25);
  const [bets, setBets] = useState<RouletteBet[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<RouletteSpinResult | null>(null);
  const [spinHistory, setSpinHistory] = useState<RouletteSpinResult[]>([]);
  const [winMessage, setWinMessage] = useState<string | null>(null);

  const totalCurrentStake = bets.reduce((sum, b) => sum + b.stake, 0);

  const placeBet = (type: RouletteBet["type"], targetNumber?: number) => {
    if (isSpinning) return;
    if (balance < totalCurrentStake + selectedChip) {
      alert("Insufficient demo balance! Claim more credits via the Demo Faucet above.");
      return;
    }

    setBets((prev) => {
      const existingIdx = prev.findIndex(
        (b) => b.type === type && (targetNumber === undefined || b.targetNumber === targetNumber)
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], stake: updated[existingIdx].stake + selectedChip };
        return updated;
      }
      return [...prev, { type, targetNumber, stake: selectedChip }];
    });
  };

  const clearBets = () => {
    if (isSpinning) return;
    setBets([]);
  };

  const handleSpin = () => {
    if (isSpinning || bets.length === 0) return;
    if (!deductCredits(totalCurrentStake)) {
      alert("Insufficient demo credits!");
      return;
    }

    setIsSpinning(true);
    setWinMessage(null);

    // Simulate wheel spin delay
    setTimeout(() => {
      const result = spinRoulette();
      const outcome = calculateRoulettePayout(bets, result);

      if (outcome.totalPayout > 0) {
        addCredits(outcome.totalPayout);
        setWinMessage(`¡Ganaste +${outcome.totalPayout.toFixed(2)}! (Ganancia Neta: +${outcome.netWin.toFixed(2)})`);
      } else {
        setWinMessage(`Sin premio esta tirada (-${totalCurrentStake.toFixed(2)}). ¡Gira de nuevo!`);
      }

      setLastResult(result);
      setSpinHistory((prev) => [result, ...prev.slice(0, 9)]);
      setIsSpinning(false);
    }, 2200);
  };

  return (
    <div className="mx-auto max-w-5xl rounded-3xl border border-amber-500/20 bg-slate-950 p-4 sm:p-6 shadow-2xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              European Roulette <span className="text-amber-400">Pro</span>
            </h2>
            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              97.3% RTP
            </span>
          </div>
          <p className="text-xs text-slate-400 sm:text-sm">
            Standard single zero (0-36). Straight bets pay 35:1. Outside bets pay 1:1 or 2:1.
          </p>
        </div>

        {/* History bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 p-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Recent:</span>
          {spinHistory.length === 0 ? (
            <span className="text-xs text-slate-600">No spins yet</span>
          ) : (
            spinHistory.map((h, i) => (
              <span
                key={i}
                className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                  h.number === 0
                    ? "bg-emerald-600 text-white"
                    : h.color === "red"
                    ? "bg-red-600 text-white"
                    : "bg-slate-800 text-slate-200"
                }`}
              >
                {h.number}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Wheel Animation & Result Stage */}
      <div className="mb-6 flex flex-col items-center justify-center rounded-2xl border border-slate-800/80 bg-linear-to-b from-slate-900 via-slate-950 to-slate-900 p-6 text-center">
        <div className="relative mb-4 flex size-40 items-center justify-center rounded-full border-4 border-amber-500/40 bg-slate-950 shadow-[0_0_50px_rgba(245,158,11,0.2)]">
          {/* Inner animated ring */}
          <div
            className={`absolute inset-2 rounded-full border-2 border-dashed border-amber-400/60 ${
              isSpinning ? "animate-spin" : ""
            }`}
            style={{ animationDuration: "0.6s" }}
          />

          {/* Central Ball / Number Result */}
          <div className="relative z-10 flex flex-col items-center">
            {isSpinning ? (
              <div className="flex flex-col items-center">
                <span className="size-5 animate-bounce rounded-full bg-white shadow-lg" />
                <span className="mt-2 text-xs font-semibold text-amber-300">Spinning...</span>
              </div>
            ) : lastResult ? (
              <div className="flex flex-col items-center">
                <span
                  className={`flex size-14 items-center justify-center rounded-full text-2xl font-black shadow-lg ${
                    lastResult.number === 0
                      ? "bg-emerald-600 text-white"
                      : lastResult.color === "red"
                      ? "bg-red-600 text-white"
                      : "bg-slate-800 text-slate-100"
                  }`}
                >
                  {lastResult.number}
                </span>
                <span className="mt-1 text-xs font-semibold tracking-wider text-amber-300 uppercase">
                  {lastResult.number === 0 ? "Zero" : `${lastResult.color} · ${lastResult.isEven ? "Even" : "Odd"}`}
                </span>
              </div>
            ) : (
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ready to Spin</div>
            )}
          </div>
        </div>

        {/* Win / Loss announcement */}
        {winMessage && (
          <div
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              winMessage.includes("Won")
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border border-slate-700 bg-slate-800/50 text-slate-300"
            }`}
          >
            {winMessage}
          </div>
        )}
      </div>

      {/* Betting Board Grid */}
      <div className="mb-6 space-y-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Place Your Bets:</div>

        {/* Zero & Numbers 1-36 */}
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[600px]">
            {/* Zero row */}
            <div className="grid grid-cols-13 gap-1">
              <button
                type="button"
                onClick={() => placeBet("straight", 0)}
                className="col-span-1 row-span-3 flex h-full min-h-[96px] items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-950/40 font-bold text-emerald-400 hover:bg-emerald-900/60"
              >
                0
              </button>

              {/* 3 rows x 12 columns numbers grid */}
              <div className="col-span-12 grid grid-cols-12 gap-1">
                {[3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map((num) => {
                  const isRed = ROULETTE_RED_NUMBERS.has(num);
                  const placed = bets.find((b) => b.type === "straight" && b.targetNumber === num);
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => placeBet("straight", num)}
                      className={`relative flex h-8 items-center justify-center rounded-md font-mono text-xs font-bold transition ${
                        isRed ? "bg-red-950/60 text-red-300 border border-red-500/40 hover:bg-red-900/60" : "bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800"
                      }`}
                    >
                      {num}
                      {placed && (
                        <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-slate-950">
                          •
                        </span>
                      )}
                    </button>
                  );
                })}

                {[2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35].map((num) => {
                  const isRed = ROULETTE_RED_NUMBERS.has(num);
                  const placed = bets.find((b) => b.type === "straight" && b.targetNumber === num);
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => placeBet("straight", num)}
                      className={`relative flex h-8 items-center justify-center rounded-md font-mono text-xs font-bold transition ${
                        isRed ? "bg-red-950/60 text-red-300 border border-red-500/40 hover:bg-red-900/60" : "bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800"
                      }`}
                    >
                      {num}
                      {placed && (
                        <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-slate-950">
                          •
                        </span>
                      )}
                    </button>
                  );
                })}

                {[1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34].map((num) => {
                  const isRed = ROULETTE_RED_NUMBERS.has(num);
                  const placed = bets.find((b) => b.type === "straight" && b.targetNumber === num);
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => placeBet("straight", num)}
                      className={`relative flex h-8 items-center justify-center rounded-md font-mono text-xs font-bold transition ${
                        isRed ? "bg-red-950/60 text-red-300 border border-red-500/40 hover:bg-red-900/60" : "bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800"
                      }`}
                    >
                      {num}
                      {placed && (
                        <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-slate-950">
                          •
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dozens */}
            <div className="mt-1 grid grid-cols-13 gap-1">
              <div className="col-span-1" />
              <button
                type="button"
                onClick={() => placeBet("dozen1")}
                className="col-span-4 rounded-md border border-slate-700 bg-slate-900 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
              >
                1st 12 (1-12)
              </button>
              <button
                type="button"
                onClick={() => placeBet("dozen2")}
                className="col-span-4 rounded-md border border-slate-700 bg-slate-900 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
              >
                2nd 12 (13-24)
              </button>
              <button
                type="button"
                onClick={() => placeBet("dozen3")}
                className="col-span-4 rounded-md border border-slate-700 bg-slate-900 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
              >
                3rd 12 (25-36)
              </button>
            </div>

            {/* Outside Bets (1-18, Even, Red, Black, Odd, 19-36) */}
            <div className="mt-1 grid grid-cols-13 gap-1">
              <div className="col-span-1" />
              <button
                type="button"
                onClick={() => placeBet("low")}
                className="col-span-2 rounded-md border border-slate-700 bg-slate-900 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
              >
                1 to 18
              </button>
              <button
                type="button"
                onClick={() => placeBet("even")}
                className="col-span-2 rounded-md border border-slate-700 bg-slate-900 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
              >
                EVEN
              </button>
              <button
                type="button"
                onClick={() => placeBet("red")}
                className="col-span-2 rounded-md border border-red-500/40 bg-red-950/60 py-1.5 text-xs font-bold text-red-300 hover:bg-red-900/60"
              >
                RED
              </button>
              <button
                type="button"
                onClick={() => placeBet("black")}
                className="col-span-2 rounded-md border border-slate-700 bg-slate-900 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-800"
              >
                BLACK
              </button>
              <button
                type="button"
                onClick={() => placeBet("odd")}
                className="col-span-2 rounded-md border border-slate-700 bg-slate-900 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
              >
                ODD
              </button>
              <button
                type="button"
                onClick={() => placeBet("high")}
                className="col-span-2 rounded-md border border-slate-700 bg-slate-900 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
              >
                19 to 36
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chip Selector & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-4">
        {/* Chip value options */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Chip:</span>
          {CHIP_VALUES.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setSelectedChip(val)}
              className={`flex size-9 items-center justify-center rounded-full text-xs font-black transition ${
                selectedChip === val
                  ? "scale-110 border-2 border-amber-400 bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30"
                  : "border border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
              }`}
            >
              {val}
            </button>
          ))}
        </div>

        {/* Action Buttons: Clear & Spin */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase">Total Bet</div>
            <div className="font-mono text-sm font-bold text-amber-300">{totalCurrentStake}</div>
          </div>

          <button
            type="button"
            onClick={clearBets}
            disabled={isSpinning || bets.length === 0}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-40"
          >
            Clear Bets
          </button>

          <button
            type="button"
            onClick={handleSpin}
            disabled={isSpinning || bets.length === 0}
            className="rounded-xl border border-amber-400 bg-linear-to-r from-amber-500 to-yellow-400 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-40 active:scale-95"
          >
            {isSpinning ? "Spinning..." : "SPIN"}
          </button>
        </div>
      </div>
    </div>
  );
}

