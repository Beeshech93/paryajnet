import assert from "node:assert/strict";
import { test } from "node:test";
import {
  spinRoulette,
  calculateRoulettePayout,
  generateCrashMultiplier,
  evaluateCrashBet,
  createDeck,
  calculateHandValue,
  playDealerHand,
  evaluateBlackjackGame,
  spinSlots,
  Card,
  SlotSymbol,
} from "./casino-engine";

// --- Roulette Tests ---
test("roulette: spin returns valid European pocket and characteristics", () => {
  const spin = spinRoulette();
  assert.ok(spin.number >= 0 && spin.number <= 36, "Pocket must be between 0 and 36");
  
  if (spin.number === 0) {
    assert.equal(spin.color, "green");
    assert.equal(spin.isEven, false);
    assert.equal(spin.dozen, null);
    assert.equal(spin.column, null);
  } else {
    assert.ok(spin.color === "red" || spin.color === "black");
    assert.ok(spin.dozen === 1 || spin.dozen === 2 || spin.dozen === 3);
    assert.ok(spin.column === 1 || spin.column === 2 || spin.column === 3);
  }
});

test("roulette: payout calculation for winning and losing bets", () => {
  // Forced spin: 14 (Red, Even, Low, Dozen 2, Col 2)
  const result = spinRoulette(14);
  assert.equal(result.number, 14);
  assert.equal(result.color, "red");
  assert.equal(result.isEven, true);
  assert.equal(result.dozen, 2);

  const bets = [
    { type: "straight" as const, targetNumber: 14, stake: 10 }, // Wins 360
    { type: "red" as const, stake: 20 },                       // Wins 40
    { type: "black" as const, stake: 15 },                     // Loses
    { type: "dozen2" as const, stake: 10 },                    // Wins 30
  ];

  const calc = calculateRoulettePayout(bets, result);
  assert.equal(calc.totalStake, 55);
  assert.equal(calc.totalPayout, 360 + 40 + 30); // 430
  assert.equal(calc.netWin, 430 - 55);           // 375
});

// --- Crash Game Tests ---
test("crash: multiplier is provably fair and bounds are strictly positive", () => {
  const game = generateCrashMultiplier("test-client-seed");
  assert.ok(game.crashMultiplier >= 1.0, "Multiplier cannot be less than 1.00x");
  assert.ok(game.crashMultiplier <= 1000.0, "Multiplier within cap");
  assert.ok(game.serverSeed.length > 0);
  assert.ok(game.hash.length > 0);
});

test("crash: evaluateBet handles cashout timing correctly", () => {
  // Crash happened at 2.50x
  const won = evaluateCrashBet(50, 2.0, 2.5);
  assert.equal(won.cashedOut, true);
  assert.equal(won.payout, 100);
  assert.equal(won.netWin, 50);

  // Crash happened at 1.80x but player waited for 2.0x
  const lost = evaluateCrashBet(50, 2.0, 1.8);
  assert.equal(lost.cashedOut, false);
  assert.equal(lost.payout, 0);
  assert.equal(lost.netWin, -50);
});

// --- Blackjack Tests ---
test("blackjack: deck generation and hand value calculation with soft aces", () => {
  const deck = createDeck();
  assert.equal(deck.length, 52, "Deck must contain 52 cards");

  // Hand: Ace + 6 = 17 (Soft)
  const handSoft: Card[] = [
    { suit: "♠", rank: "A", value: 11 },
    { suit: "♥", rank: "6", value: 6 },
  ];
  const valSoft = calculateHandValue(handSoft);
  assert.equal(valSoft.total, 17);
  assert.equal(valSoft.isSoft, true);
  assert.equal(valSoft.isBust, false);

  // Hand: Ace + 6 + 8 = 15 (Ace reduces from 11 to 1)
  const handReduced: Card[] = [...handSoft, { suit: "♦", rank: "8", value: 8 }];
  const valReduced = calculateHandValue(handReduced);
  assert.equal(valReduced.total, 15);
  assert.equal(valReduced.isSoft, false);
  assert.equal(valReduced.isBust, false);
});

test("blackjack: game evaluation handles natural blackjack 3:2 payout and dealer bust", () => {
  const naturalBJ: Card[] = [
    { suit: "♠", rank: "A", value: 11 },
    { suit: "♠", rank: "K", value: 10 },
  ];
  const dealerStandard: Card[] = [
    { suit: "♥", rank: "10", value: 10 },
    { suit: "♦", rank: "9", value: 9 },
  ];

  // Natural Blackjack 3:2 payout on 100 stake = 100 stake + 150 profit = 250
  const bjResult = evaluateBlackjackGame(naturalBJ, dealerStandard, 100);
  assert.equal(bjResult.outcome, "PLAYER_BLACKJACK");
  assert.equal(bjResult.payout, 250);
  assert.equal(bjResult.netWin, 150);

  // Dealer bust
  const player18: Card[] = [
    { suit: "♣", rank: "10", value: 10 },
    { suit: "♣", rank: "8", value: 8 },
  ];
  const dealerBust: Card[] = [
    { suit: "♦", rank: "10", value: 10 },
    { suit: "♦", rank: "6", value: 6 },
    { suit: "♦", rank: "7", value: 7 }, // Total 23 -> Bust
  ];
  const bustResult = evaluateBlackjackGame(player18, dealerBust, 50);
  assert.equal(bustResult.outcome, "PLAYER_WIN");
  assert.equal(bustResult.payout, 100);
  assert.equal(bustResult.netWin, 50);
});

// --- Golden Slots Tests ---
test("slots: generates 5x3 grid and correctly evaluates horizontal paylines", () => {
  // Forced grid with 5 "7" on center line (Row 1)
  const forcedGrid: SlotSymbol[][] = [
    ["CHERRY", "7", "GRAPES"],
    ["CHERRY", "7", "GRAPES"],
    ["CHERRY", "7", "GRAPES"],
    ["CHERRY", "7", "GRAPES"],
    ["CHERRY", "7", "GRAPES"],
  ];

  const outcome = spinSlots(10, forcedGrid);
  assert.equal(outcome.grid.length, 5);
  assert.equal(outcome.grid[0].length, 3);
  
  // Center line (lineIndex 0) has five 7s -> 250x multiplier * 10 bet = 2500
  const centerWin = outcome.winningLines.find((l) => l.lineIndex === 0);
  assert.ok(centerWin, "Center payline must win");
  assert.equal(centerWin.symbol, "7");
  assert.equal(centerWin.count, 5);
  assert.equal(centerWin.multiplier, 250);
  assert.equal(centerWin.payout, 2500);
});

