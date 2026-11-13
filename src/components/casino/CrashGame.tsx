"use client";

import React, { useEffect, useRef, useState } from "react";
import { useDemoWallet } from "./DemoWalletProvider";
import { generateCrashMultiplier } from "@/lib/casino-engine";

export function CrashGame() {
  const { balance, deductCredits, addCredits } = useDemoWallet();
  const [stake, setStake] = useState<number>(50);
  const [autoCashout, setAutoCashout] = useState<string>("2.00");
  const [gameState, setGameState] = useState<"IDLE" | "RUNNING" | "CRASHED" | "CASHED_OUT">("IDLE");
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.0);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [hash, setHash] = useState<string>("");
  const [serverSeed, setServerSeed] = useState<string>("");
  const [winAmount, setWinAmount] = useState<number | null>(null);
  const [recentCrashPoints, setRecentCrashPoints] = useState<number[]>([1.84, 3.42, 1.12, 12.8, 1.45, 2.05]);

  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const targetCrashRef = useRef<number>(1.0);
  const cashedOutRef = useRef<boolean>(false);

  const startGame = () => {
    if (gameState === "RUNNING") return;
    if (stake <= 0 || balance < stake) {
      alert("Insufficient demo credits! Use the Demo Faucet above.");
      return;
    }

    if (!deductCredits(stake)) return;

    // Generate provably fair crash outcome
    const outcome = generateCrashMultiplier();
    targetCrashRef.current = outcome.crashMultiplier;
    setCrashPoint(outcome.crashMultiplier);
    setHash(outcome.hash);
    setServerSeed(outcome.serverSeed);
    cashedOutRef.current = false;
    setWinAmount(null);
    setGameState("RUNNING");
    setCurrentMultiplier(1.0);

    startTimeRef.current = performance.now();

    const loop = (now: number) => {
      const elapsedSeconds = (now - startTimeRef.current) / 1000;
      // Exponential curve: e^(0.06 * t)
      const mult = Math.max(1.0, Math.floor(Math.pow(Math.E, 0.08 * elapsedSeconds) * 100) / 100);

      // Check auto-cashout
      const autoVal = parseFloat(autoCashout);
      if (!isNaN(autoVal) && autoVal > 1.0 && mult >= autoVal && !cashedOutRef.current) {
        handleCashOut(mult);
      }

      if (mult >= targetCrashRef.current) {
        // Crashed!
        setCurrentMultiplier(targetCrashRef.current);
        if (!cashedOutRef.current) {
          setGameState("CRASHED");
        }
        setRecentCrashPoints((prev) => [targetCrashRef.current, ...prev.slice(0, 7)]);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        return;
      }

      setCurrentMultiplier(mult);
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  };

  const handleCashOut = (multOverride?: number) => {
    if (gameState !== "RUNNING" || cashedOutRef.current) return;
    cashedOutRef.current = true;
    const mult = multOverride !== undefined ? multOverride : currentMultiplier;
    const win = Math.round(stake * mult * 100) / 100;
    addCredits(win);
    setWinAmount(win);
    setGameState("CASHED_OUT");
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl rounded-3xl border border-amber-500/20 bg-slate-950 p-4 sm:p-6 shadow-2xl">
      {/* Game Title */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Crash Aviator <span className="text-amber-400">Pro</span>
            </h2>
            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              DEMO 97.0% RTP
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Watch the rocket fly! Cash out before the crash to win your stake multiplied.
          </p>
        </div>

        {/* History of recent multipliers */}
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 p-2">
          {recentCrashPoints.map((cp, idx) => (
            <span
              key={idx}
              className={`rounded-md px-2 py-0.5 text-xs font-mono font-bold ${
                cp >= 2.0 ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-400"
              }`}
            >
              {cp.toFixed(2)}x
            </span>
          ))}
        </div>
      </div>

      {/* Main Canvas / Flight Arena */}
      <div className="relative mb-6 flex h-64 sm:h-80 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-linear-to-b from-slate-900 via-slate-950 to-slate-950 p-4">
        {/* Grid lines background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />

        {/* Multiplier Central Display */}
        <div className="relative z-10 text-center">
          {gameState === "CRASHED" ? (
            <div className="animate-pulse">
              <div className="font-mono text-5xl sm:text-6xl font-black text-red-500 drop-shadow-[0_0_25px_rgba(239,68,68,0.5)]">
                FLEW AWAY!
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-red-400/80">
                @ {currentMultiplier.toFixed(2)}x
              </div>
            </div>
          ) : gameState === "CASHED_OUT" ? (
            <div className="animate-bounce">
              <div className="font-mono text-5xl sm:text-6xl font-black text-emerald-400 drop-shadow-[0_0_25px_rgba(52,211,153,0.5)]">
                {currentMultiplier.toFixed(2)}x
              </div>
              <div className="mt-1 font-bold text-emerald-300">
                Cashed Out! Won +{winAmount?.toFixed(2)} Demo Credits
              </div>
            </div>
          ) : (
            <div>
              <div
                className={`font-mono text-6xl sm:text-7xl font-black tracking-tight ${
                  gameState === "RUNNING"
                    ? "text-amber-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.6)]"
                    : "text-slate-600"
                }`}
              >
                {currentMultiplier.toFixed(2)}x
              </div>
              <div className="mt-2 text-xs font-semibold text-slate-400 uppercase tracking-widest">
                {gameState === "RUNNING" ? "🚀 In Flight..." : "Waiting for next launch"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Control Panel: Bet amount, Auto Cashout, Action Button */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Stake setting */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <label className="mb-1 block text-xs font-bold text-slate-400 uppercase">Demo Stake</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="5"
              step="5"
              disabled={gameState === "RUNNING"}
              value={stake}
              onChange={(e) => setStake(Math.max(5, parseFloat(e.target.value) || 0))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm font-bold text-white outline-none focus:border-amber-400"
            />
            <button
              type="button"
              disabled={gameState === "RUNNING"}
              onClick={() => setStake((s) => s * 2)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              2X
            </button>
            <button
              type="button"
              disabled={gameState === "RUNNING"}
              onClick={() => setStake((s) => Math.max(5, Math.floor(s / 2)))}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            >
              ½
            </button>
          </div>
        </div>

        {/* Auto Cashout multiplier */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <label className="mb-1 block text-xs font-bold text-slate-400 uppercase">Auto Cashout (x)</label>
          <input
            type="number"
            min="1.01"
            step="0.10"
            disabled={gameState === "RUNNING"}
            value={autoCashout}
            onChange={(e) => setAutoCashout(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm font-bold text-white outline-none focus:border-amber-400"
            placeholder="2.00"
          />
        </div>

        {/* Primary Action Button */}
        <div className="flex items-end">
          {gameState === "RUNNING" && !cashedOutRef.current ? (
            <button
              type="button"
              onClick={() => handleCashOut()}
              className="w-full rounded-xl border border-emerald-400 bg-linear-to-r from-emerald-500 to-green-500 py-3.5 text-center font-bold text-slate-950 shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-green-400 active:scale-95"
            >
              CASH OUT ({(stake * currentMultiplier).toFixed(2)} Demo)
            </button>
          ) : (
            <button
              type="button"
              onClick={startGame}
              className="w-full rounded-xl border border-amber-400 bg-linear-to-r from-amber-500 to-yellow-400 py-3.5 text-center font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-yellow-300 active:scale-95"
            >
              BET ({stake} Demo)
            </button>
          )}
        </div>
      </div>

      {/* Provably Fair Hash Audit Accordion */}
      {hash && (
        <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-[11px] text-slate-400">
          <div className="font-semibold text-slate-300">Provably Fair Round Verification:</div>
          <div className="mt-1 truncate font-mono text-[10px] text-slate-500">
            SHA-256 HMAC: <span className="text-amber-400/80">{hash}</span>
          </div>
          {gameState !== "RUNNING" && (
            <div className="truncate font-mono text-[10px] text-slate-500">
              Server Seed: <span className="text-slate-400">{serverSeed}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

