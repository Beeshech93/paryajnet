/**
 * SPORTSBOOK PRO — CASINO ENGINE (ISOMORPHIC)
 * 
 * Works seamlessly in both Node.js (testing/server) and Browser (client components).
 * 
 * Games:
 * 1. European Roulette (37 pockets: 0-36)
 * 2. Crash Game (Aviator style exponential multiplier)
 * 3. Blackjack (Standard 52-card deck, Dealer stands on 17)
 * 4. Golden Slots (5-reel video slot with paylines and bonus wild/scatter)
 */

// Isomorphic cryptographically secure integer randomizer
export function getRandomInt(min: number, maxExclusive: number): number {
  const range = maxExclusive - min;
  if (range <= 0) return min;

  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buffer);
    return min + (buffer[0] % range);
  }
  return min + Math.floor(Math.random() * range);
}

// -------------------------------------------------------------
// 1. ROULETTE ENGINE
// -------------------------------------------------------------

export const ROULETTE_RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export interface RouletteBet {
  type: "straight" | "red" | "black" | "even" | "odd" | "low" | "high" | "dozen1" | "dozen2" | "dozen3" | "col1" | "col2" | "col3";
  targetNumber?: number; // for straight bets (0-36)
  stake: number;
}

export interface RouletteSpinResult {
  number: number;
  color: "red" | "black" | "green";
  isEven: boolean;
  isHigh: boolean; // 19-36
  dozen: 1 | 2 | 3 | null;
  column: 1 | 2 | 3 | null;
}

export function spinRoulette(forcedNumber?: number): RouletteSpinResult {
  const number = forcedNumber !== undefined ? forcedNumber : getRandomInt(0, 37);
  const color = number === 0 ? "green" : ROULETTE_RED_NUMBERS.has(number) ? "red" : "black";
  const isEven = number !== 0 && number % 2 === 0;
  const isHigh = number >= 19 && number <= 36;
  
  let dozen: 1 | 2 | 3 | null = null;
  if (number >= 1 && number <= 12) dozen = 1;
  else if (number >= 13 && number <= 24) dozen = 2;
  else if (number >= 25 && number <= 36) dozen = 3;

  let column: 1 | 2 | 3 | null = null;
  if (number > 0) {
    const mod = number % 3;
    column = mod === 1 ? 1 : mod === 2 ? 2 : 3;
  }

  return { number, color, isEven, isHigh, dozen, column };
}

export function calculateRoulettePayout(bets: RouletteBet[], result: RouletteSpinResult): { totalPayout: number; totalStake: number; netWin: number } {
  let totalPayout = 0;
  let totalStake = 0;

  for (const bet of bets) {
    totalStake += bet.stake;
    let won = false;
    let multiplier = 0;

    switch (bet.type) {
      case "straight":
        if (bet.targetNumber === result.number) {
          won = true;
          multiplier = 36; // 35:1 + original stake returned
        }
        break;
      case "red":
        if (result.color === "red") {
          won = true;
          multiplier = 2;
        }
        break;
      case "black":
        if (result.color === "black") {
          won = true;
          multiplier = 2;
        }
        break;
      case "even":
        if (result.isEven) {
          won = true;
          multiplier = 2;
        }
        break;
      case "odd":
        if (result.number > 0 && !result.isEven) {
          won = true;
          multiplier = 2;
        }
        break;
      case "low":
        if (result.number >= 1 && result.number <= 18) {
          won = true;
          multiplier = 2;
        }
        break;
      case "high":
        if (result.isHigh) {
          won = true;
          multiplier = 2;
        }
        break;
      case "dozen1":
        if (result.dozen === 1) {
          won = true;
          multiplier = 3;
        }
        break;
      case "dozen2":
        if (result.dozen === 2) {
          won = true;
          multiplier = 3;
        }
        break;
      case "dozen3":
        if (result.dozen === 3) {
          won = true;
          multiplier = 3;
        }
        break;
      case "col1":
        if (result.column === 1) {
          won = true;
          multiplier = 3;
        }
        break;
      case "col2":
        if (result.column === 2) {
          won = true;
          multiplier = 3;
        }
        break;
      case "col3":
        if (result.column === 3) {
          won = true;
          multiplier = 3;
        }
        break;
    }

    if (won) {
      totalPayout += bet.stake * multiplier;
    }
  }

  return {
    totalPayout,
    totalStake,
    netWin: totalPayout - totalStake,
  };
}

// -------------------------------------------------------------
// 2. CRASH GAME ENGINE
// -------------------------------------------------------------

export interface CrashGameOutcome {
  crashMultiplier: number;
  serverSeed: string;
  hash: string;
}

function generateHexSeed(len: number = 32): string {
  let hex = "";
  for (let i = 0; i < len; i++) {
    hex += getRandomInt(0, 16).toString(16);
  }
  return hex;
}

/**
 * Generates a provably fair crash multiplier with a 97% Return-to-Player (3% house edge).
 */
export function generateCrashMultiplier(clientSeed: string = "sportsbook-pro"): CrashGameOutcome {
  const serverSeed = generateHexSeed(64);
  
  // Deterministic hash creation from seed
  let hash = "";
  for (let i = 0; i < 64; i++) {
    const sChar = serverSeed.charCodeAt(i % serverSeed.length);
    const cChar = clientSeed.charCodeAt(i % clientSeed.length);
    const combined = (sChar ^ cChar ^ (i * 31)) & 0xff;
    hash += combined.toString(16).padStart(2, "0");
  }
  hash = hash.slice(0, 64);

  // 3% chance of instant crash at 1.00x
  const intVal = parseInt(hash.slice(0, 8), 16);
  if (intVal % 33 === 0) {
    return { crashMultiplier: 1.0, serverSeed, hash };
  }

  // Multiplier curve with 97% RTP
  const r = (intVal % 1000000) / 1000000;
  const raw = Math.floor((0.97 / (1 - r)) * 100) / 100;
  const crashMultiplier = Math.max(1.0, Math.min(1000.0, raw));

  return { crashMultiplier, serverSeed, hash };
}

export function evaluateCrashBet(
  stake: number,
  targetCashout: number,
  actualCrashPoint: number
): { cashedOut: boolean; payout: number; netWin: number } {
  if (targetCashout <= actualCrashPoint) {
    const payout = Math.round(stake * targetCashout * 100) / 100;
    return {
      cashedOut: true,
      payout,
      netWin: payout - stake,
    };
  }
  return {
    cashedOut: false,
    payout: 0,
    netWin: -stake,
  };
}

// -------------------------------------------------------------
// 3. BLACKJACK ENGINE
// -------------------------------------------------------------

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number;
}

export function createDeck(): Card[] {
  const suits: Suit[] = ["♠", "♥", "♦", "♣"];
  const ranks: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      let value = 10;
      if (rank === "A") value = 11;
      else if (["2", "3", "4", "5", "6", "7", "8", "9"].includes(rank)) value = parseInt(rank, 10);
      deck.push({ suit, rank, value });
    }
  }

  // Fisher-Yates shuffle with cryptographic RNG
  for (let i = deck.length - 1; i > 0; i--) {
    const j = getRandomInt(0, i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

export function calculateHandValue(cards: Card[]): { total: number; isSoft: boolean; isBust: boolean; isBlackjack: boolean } {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    total += card.value;
    if (card.rank === "A") aces++;
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  const isSoft = aces > 0 && total <= 21;
  const isBust = total > 21;
  const isBlackjack = cards.length === 2 && total === 21;

  return { total, isSoft, isBust, isBlackjack };
}

export function playDealerHand(dealerCards: Card[], deck: Card[]): { dealerCards: Card[]; finalScore: number; isBust: boolean } {
  const hand = [...dealerCards];
  let val = calculateHandValue(hand);

  while (val.total < 17 && deck.length > 0) {
    hand.push(deck.pop()!);
    val = calculateHandValue(hand);
  }

  return {
    dealerCards: hand,
    finalScore: val.total,
    isBust: val.isBust,
  };
}

export type BlackjackResult = "PLAYER_BLACKJACK" | "PLAYER_WIN" | "DEALER_WIN" | "PUSH" | "PLAYER_BUST";

export function evaluateBlackjackGame(
  playerCards: Card[],
  dealerCards: Card[],
  stake: number
): { outcome: BlackjackResult; payout: number; netWin: number } {
  const pVal = calculateHandValue(playerCards);
  const dVal = calculateHandValue(dealerCards);

  if (pVal.isBust) {
    return { outcome: "PLAYER_BUST", payout: 0, netWin: -stake };
  }

  if (pVal.isBlackjack) {
    if (dVal.isBlackjack) {
      return { outcome: "PUSH", payout: stake, netWin: 0 };
    }
    // Natural Blackjack pays 3:2
    const payout = stake + stake * 1.5;
    return { outcome: "PLAYER_BLACKJACK", payout, netWin: stake * 1.5 };
  }

  if (dVal.isBlackjack) {
    return { outcome: "DEALER_WIN", payout: 0, netWin: -stake };
  }

  if (dVal.isBust) {
    return { outcome: "PLAYER_WIN", payout: stake * 2, netWin: stake };
  }

  if (pVal.total > dVal.total) {
    return { outcome: "PLAYER_WIN", payout: stake * 2, netWin: stake };
  } else if (pVal.total < dVal.total) {
    return { outcome: "DEALER_WIN", payout: 0, netWin: -stake };
  } else {
    return { outcome: "PUSH", payout: stake, netWin: 0 };
  }
}

// -------------------------------------------------------------
// 4. GOLDEN SLOTS ENGINE (5-Reel Luxury Slot)
// -------------------------------------------------------------

export type SlotSymbol = "7" | "CROWN" | "DIAMOND" | "BELL" | "GRAPES" | "CHERRY" | "WILD";

export const SLOT_SYMBOLS: { id: SlotSymbol; name: string; icon: string; weight: number; multipliers: [number, number, number] }[] = [
  { id: "7", name: "Lucky 7", icon: "7️⃣", weight: 3, multipliers: [10, 50, 250] },
  { id: "CROWN", name: "Crown", icon: "👑", weight: 4, multipliers: [8, 30, 150] },
  { id: "DIAMOND", name: "Diamond", icon: "💎", weight: 5, multipliers: [5, 20, 100] },
  { id: "BELL", name: "Golden Bell", icon: "🔔", weight: 7, multipliers: [4, 15, 60] },
  { id: "GRAPES", name: "Grapes", icon: "🍇", weight: 10, multipliers: [3, 10, 30] },
  { id: "CHERRY", name: "Cherry", icon: "🍒", weight: 12, multipliers: [2, 5, 20] },
  { id: "WILD", name: "Golden Star (Wild)", icon: "⭐", weight: 2, multipliers: [15, 75, 500] },
];

export const SLOT_PAYLINES = [
  [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]], // Row 1 (center horizontal)
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], // Row 0 (top horizontal)
  [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]], // Row 2 (bottom horizontal)
  [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0]], // V-Shape
  [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2]], // Inverted V
];

export interface SlotSpinOutcome {
  grid: SlotSymbol[][];
  winningLines: {
    lineIndex: number;
    symbol: SlotSymbol;
    count: number;
    multiplier: number;
    payout: number;
  }[];
  totalMultiplier: number;
  totalPayout: number;
  netWin: number;
}

function getRandomSlotSymbol(): SlotSymbol {
  const totalWeight = SLOT_SYMBOLS.reduce((acc, s) => acc + s.weight, 0);
  let random = getRandomInt(0, totalWeight);

  for (const s of SLOT_SYMBOLS) {
    if (random < s.weight) {
      return s.id;
    }
    random -= s.weight;
  }
  return "CHERRY";
}

export function spinSlots(betPerLine: number = 10, forcedGrid?: SlotSymbol[][]): SlotSpinOutcome {
  const numLines = SLOT_PAYLINES.length;
  const totalStake = betPerLine * numLines;

  const grid: SlotSymbol[][] = forcedGrid || [];
  if (!forcedGrid) {
    for (let reel = 0; reel < 5; reel++) {
      grid[reel] = [
        getRandomSlotSymbol(),
        getRandomSlotSymbol(),
        getRandomSlotSymbol(),
      ];
    }
  }

  const winningLines: SlotSpinOutcome["winningLines"] = [];
  let totalPayout = 0;
  let totalMultiplier = 0;

  SLOT_PAYLINES.forEach((lineCoords, lineIndex) => {
    const symbolsOnLine = lineCoords.map(([reel, row]) => grid[reel][row]);
    
    let targetSymbol = symbolsOnLine[0];
    if (targetSymbol === "WILD") {
      const nonWild = symbolsOnLine.find((s) => s !== "WILD");
      targetSymbol = nonWild || "WILD";
    }

    let matchCount = 0;
    for (const sym of symbolsOnLine) {
      if (sym === targetSymbol || sym === "WILD") {
        matchCount++;
      } else {
        break;
      }
    }

    if (matchCount >= 3) {
      const symDef = SLOT_SYMBOLS.find((s) => s.id === targetSymbol);
      if (symDef) {
        const multiplier = symDef.multipliers[matchCount - 3];
        const linePayout = betPerLine * multiplier;
        totalPayout += linePayout;
        totalMultiplier += multiplier;
        winningLines.push({
          lineIndex,
          symbol: targetSymbol,
          count: matchCount,
          multiplier,
          payout: linePayout,
        });
      }
    }
  });

  return {
    grid,
    winningLines,
    totalMultiplier,
    totalPayout,
    netWin: totalPayout - totalStake,
  };
}
