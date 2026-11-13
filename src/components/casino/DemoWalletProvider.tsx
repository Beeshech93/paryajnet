"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  DEFAULT_DEMO_BALANCE,
  DEMO_CURRENCIES,
  DemoCurrency,
  FAUCET_RELOAD_AMOUNT,
  formatDemoCurrency,
} from "@/lib/demo-wallet";

interface DemoWalletContextType {
  balance: number;
  currency: DemoCurrency;
  setCurrency: (c: DemoCurrency) => void;
  deductCredits: (amount: number) => boolean;
  addCredits: (amount: number) => void;
  claimFaucet: () => void;
  resetBalance: () => void;
  formattedBalance: string;
  isDemo: true;
}

const DemoWalletContext = createContext<DemoWalletContextType | null>(null);

const STORAGE_KEY_BALANCE = "sportsbook_pro_demo_balance";
const STORAGE_KEY_CURRENCY = "sportsbook_pro_demo_currency";

export function DemoWalletProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState<number>(DEFAULT_DEMO_BALANCE);
  const [currency, setCurrencyState] = useState<DemoCurrency>("MXN");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const savedBalance = localStorage.getItem(STORAGE_KEY_BALANCE);
      if (savedBalance !== null) {
        const parsed = parseFloat(savedBalance);
        if (!isNaN(parsed) && parsed >= 0) {
          setBalance(parsed);
        }
      }

      const savedCurrency = localStorage.getItem(STORAGE_KEY_CURRENCY) as DemoCurrency;
      if (savedCurrency && DEMO_CURRENCIES[savedCurrency]) {
        setCurrencyState(savedCurrency);
      }
    } catch {
      // ignore storage access errors
    }
    setIsInitialized(true);
  }, []);

  const saveBalance = (newBalance: number) => {
    setBalance(newBalance);
    try {
      localStorage.setItem(STORAGE_KEY_BALANCE, newBalance.toString());
      window.dispatchEvent(new Event("demo_balance_updated"));
    } catch {
      // ignore
    }
  };

  const setCurrency = (c: DemoCurrency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(STORAGE_KEY_CURRENCY, c);
    } catch {
      // ignore
    }
  };

  const deductCredits = (amount: number): boolean => {
    if (amount <= 0) return true;
    if (balance < amount) return false;
    saveBalance(balance - amount);
    return true;
  };

  const addCredits = (amount: number) => {
    if (amount <= 0) return;
    saveBalance(balance + amount);
  };

  const claimFaucet = () => {
    saveBalance(balance + FAUCET_RELOAD_AMOUNT);
  };

  const resetBalance = () => {
    saveBalance(DEFAULT_DEMO_BALANCE);
  };

  const formattedBalance = formatDemoCurrency(balance, currency);

  return (
    <DemoWalletContext.Provider
      value={{
        balance,
        currency,
        setCurrency,
        deductCredits,
        addCredits,
        claimFaucet,
        resetBalance,
        formattedBalance,
        isDemo: true,
      }}
    >
      {children}
    </DemoWalletContext.Provider>
  );
}

export function useDemoWallet() {
  const ctx = useContext(DemoWalletContext);
  if (!ctx) {
    throw new Error("useDemoWallet must be used within DemoWalletProvider");
  }
  return ctx;
}

