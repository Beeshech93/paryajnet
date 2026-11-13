/**
 * SPORTSBOOK PRO — SIMULATED DEMO WALLET
 * 
 * Manages virtual demo credits exclusively for entertainment & testing.
 * Credits have NO cash value and cannot be deposited, transferred, or withdrawn.
 */

export type DemoCurrency = "MXN" | "HTG" | "USD";

export interface DemoCurrencyInfo {
  code: DemoCurrency;
  symbol: string;
  name: string;
  country: string;
  flag: string;
}

export const DEMO_CURRENCIES: Record<DemoCurrency, DemoCurrencyInfo> = {
  MXN: { code: "MXN", symbol: "MX$", name: "Peso Mexicano (Demo)", country: "Mexico", flag: "🇲🇽" },
  HTG: { code: "HTG", symbol: "G", name: "Goud Ayisyen (Demo)", country: "Haiti", flag: "🇭🇹" },
  USD: { code: "USD", symbol: "$", name: "US Dollar (Demo)", country: "Global", flag: "🌐" },
};

export const DEFAULT_DEMO_BALANCE = 5000;
export const FAUCET_RELOAD_AMOUNT = 1000;

export function formatDemoCurrency(amount: number, currency: DemoCurrency = "MXN"): string {
  const info = DEMO_CURRENCIES[currency] || DEMO_CURRENCIES.MXN;
  const formattedNumber = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `${info.symbol} ${formattedNumber}`;
}

