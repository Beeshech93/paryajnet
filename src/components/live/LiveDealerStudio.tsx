"use client";

import React, { useEffect, useState } from "react";
import { useDemoWallet } from "../casino/DemoWalletProvider";
import { RouletteGame } from "../casino/RouletteGame";

interface PlayerBetActivity {
  id: string;
  flag: string;
  name: string;
  bet: string;
  stake: string;
  time: string;
}

const INITIAL_PLAYER_BETS: PlayerBetActivity[] = [
  { id: "1", flag: "🇲🇽", name: "Rodrigo V.", bet: "Rojo (Red)", stake: "MX$ 250", time: "Just now" },
  { id: "2", flag: "🇭🇹", name: "Jean-Claude B.", bet: "Nimewo 17 (Straight)", stake: "G 500", time: "1s ago" },
  { id: "3", flag: "🇲🇽", name: "Valeria M.", bet: "1st 12 (1-12)", stake: "MX$ 100", time: "3s ago" },
  { id: "4", flag: "🌐", name: "Alex K.", bet: "Black / Noir", stake: "$ 50", time: "4s ago" },
  { id: "5", flag: "🇭🇹", name: "Daphney S.", bet: "Pè (Even)", stake: "G 200", time: "6s ago" },
];

export function LiveDealerStudio() {
  const { balance } = useDemoWallet();
  const [roundSeconds, setRoundSeconds] = useState(18);
  const [roundPhase, setRoundPhase] = useState<"BETS_OPEN" | "NO_MORE_BETS" | "SPINNING" | "WINNER_ANNOUNCED">("BETS_OPEN");
  const [multiplayerBets, setMultiplayerBets] = useState<PlayerBetActivity[]>(INITIAL_PLAYER_BETS);
  const [onlineCount, setOnlineCount] = useState(148);

  useEffect(() => {
    const timer = setInterval(() => {
      setRoundSeconds((prev) => {
        if (prev > 1) {
          if (prev <= 5 && roundPhase === "BETS_OPEN") {
            setRoundPhase("NO_MORE_BETS");
          }
          return prev - 1;
        }

        // Cycle through phases
        if (roundPhase === "NO_MORE_BETS" || roundPhase === "BETS_OPEN") {
          setRoundPhase("SPINNING");
          return 4;
        } else if (roundPhase === "SPINNING") {
          setRoundPhase("WINNER_ANNOUNCED");
          return 5;
        } else {
          setRoundPhase("BETS_OPEN");
          return 20;
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [roundPhase]);

  // Simulate incoming multiplayer bets
  useEffect(() => {
    const betInterval = setInterval(() => {
      const mockNames = [
        { flag: "🇲🇽", name: "Mateo S.", bet: "Negro", stake: "MX$ 200" },
        { flag: "🇭🇹", name: "Junior P.", bet: "Nimewo 32", stake: "G 300" },
        { flag: "🇲🇽", name: "Camila R.", bet: "Docena 2", stake: "MX$ 150" },
        { flag: "🌐", name: "David L.", bet: "Odd (Impar)", stake: "$ 40" },
      ];
      const pick = mockNames[Math.floor(Math.random() * mockNames.length)];
      setMultiplayerBets((prev) => [
        { id: Math.random().toString(), ...pick, time: "Just now" },
        ...prev.slice(0, 5),
      ]);
      setOnlineCount((c) => c + (Math.random() > 0.5 ? 1 : -1));
    }, 3500);

    return () => clearInterval(betInterval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Live Studio Stage Header */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-linear-to-r from-slate-950 via-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Live studio video badge */}
            <div className="relative flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-red-600 to-rose-700 shadow-lg shadow-red-600/30">
              <span className="text-xl">📹</span>
              <span className="absolute -top-1 -right-1 flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-red-500" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                  Live Roulette Studio Pro
                </h2>
                <span className="rounded-full border border-red-500/50 bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">
                  HD STREAM SIMULATION
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Dealer: <span className="font-semibold text-amber-300">Elena G.</span> · Table #04 · European Rules
              </p>
            </div>
          </div>

          {/* Round Countdown Ticker */}
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {roundPhase === "BETS_OPEN"
                  ? "Time to Bet"
                  : roundPhase === "NO_MORE_BETS"
                  ? "Closing..."
                  : roundPhase === "SPINNING"
                  ? "Spinning"
                  : "Round Result"}
              </div>
              <div
                className={`font-mono text-lg font-black ${
                  roundSeconds <= 5 ? "text-red-400 animate-pulse" : "text-amber-400"
                }`}
              >
                {roundPhase === "SPINNING" ? "WHEEL IN MOTION" : `${roundSeconds}s`}
              </div>
            </div>

            {/* Players online at table */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-300">
              <span className="size-2 rounded-full bg-emerald-400" />
              <span>{onlineCount} Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio Grid: Game Table + Live Multiplayer Bets Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Game Column (8 cols) */}
        <div className="lg:col-span-8">
          <RouletteGame />
        </div>

        {/* Live Multiplayer Feed Column (4 cols) */}
        <div className="lg:col-span-4 flex flex-col rounded-3xl border border-amber-500/20 bg-slate-950 p-5 shadow-2xl">
          <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="size-2 animate-ping rounded-full bg-emerald-400" />
              <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">
                Live Multiplayer Activity
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500">Live Sync</span>
          </div>

          {/* List of live bets from other players */}
          <div className="space-y-2.5 overflow-y-auto max-h-[500px] pr-1">
            {multiplayerBets.map((pb) => (
              <div
                key={pb.id}
                className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/70 p-2.5 text-xs transition duration-200 hover:border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{pb.flag}</span>
                  <div>
                    <div className="font-semibold text-slate-200">{pb.name}</div>
                    <div className="text-[10px] text-slate-400">{pb.bet}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-amber-300">{pb.stake}</div>
                  <div className="text-[9px] text-slate-500">{pb.time}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Live Studio Chat simulation box */}
          <div className="mt-auto border-t border-slate-800 pt-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-[11px] text-slate-400">
              <span className="font-bold text-amber-400">Dealer Elena G.:</span> &quot;Good luck to all players in Mexico and Haiti! Place your chips.&quot;
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
