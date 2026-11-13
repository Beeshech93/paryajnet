"use client";

import React, { useState } from "react";
import { useDemoWallet } from "./DemoWalletProvider";
import { DEMO_CURRENCIES, DemoCurrency } from "@/lib/demo-wallet";

export function DemoBar() {
  const { balance, currency, setCurrency, claimFaucet, resetBalance, formattedBalance } = useDemoWallet();
  const [faucetClaimed, setFaucetClaimed] = useState(false);

  const handleFaucet = () => {
    claimFaucet();
    setFaucetClaimed(true);
    setTimeout(() => setFaucetClaimed(false), 2000);
  };

  return (
    <div className="w-full border-b border-amber-500/20 bg-linear-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-2 text-xs">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        {/* Left: Premium VIP account status */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-gradient-to-r from-amber-400/20 to-yellow-500/10 px-2.5 py-0.5 font-bold tracking-wider text-amber-300">
            <span className="size-1.5 rounded-full bg-amber-400" />
            CUENTA VIP
          </span>
          <span className="hidden text-slate-400 sm:inline">
            Billetera Principal
          </span>
        </div>

        {/* Right: Balance, Currency Switcher, Reload */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Currency selector */}
          <div className="flex items-center rounded-lg border border-slate-700/60 bg-slate-800/80 p-0.5">
            {(Object.keys(DEMO_CURRENCIES) as DemoCurrency[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition ${
                  currency === c
                    ? "bg-amber-400 font-bold text-slate-950 shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title={DEMO_CURRENCIES[c].name}
              >
                <span>{DEMO_CURRENCIES[c].flag}</span>
                <span>{c}</span>
              </button>
            ))}
          </div>

          {/* Balance display */}
          <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-slate-900/90 px-3 py-1 font-mono font-bold text-amber-300 shadow-inner">
            <span className="text-[10px] text-amber-500/80 uppercase">Saldo:</span>
            <span>{formattedBalance}</span>
          </div>

          {/* Reload button */}
          <button
            type="button"
            onClick={handleFaucet}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-semibold transition ${
              faucetClaimed
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                : "border-amber-400/40 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25 active:scale-95"
            }`}
            title="Recargar +1,000 de saldo"
          >
            <span>{faucetClaimed ? "✓ Recargado!" : "+1,000 Recarga"}</span>
          </button>

          {/* Reset button if balance is low */}
          {balance < 100 && (
            <button
              type="button"
              onClick={resetBalance}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-slate-300 hover:bg-slate-700"
              title="Restablecer saldo inicial"
            >
              Restablecer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

