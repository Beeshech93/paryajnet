"use client";

import React, { useState } from "react";
import { useDemoWallet } from "./DemoWalletProvider";
import {
  BlackjackResult,
  calculateHandValue,
  Card,
  createDeck,
  evaluateBlackjackGame,
  playDealerHand,
} from "@/lib/casino-engine";

export function BlackjackGame() {
  const { balance, deductCredits, addCredits } = useDemoWallet();
  const [bet, setBet] = useState<number>(25);
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [dealerHoleHidden, setDealerHoleHidden] = useState<boolean>(true);
  const [gameState, setGameState] = useState<"BETTING" | "PLAYER_TURN" | "RESOLVED">("BETTING");
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [winOutcome, setWinOutcome] = useState<BlackjackResult | null>(null);

  const startDeal = () => {
    if (bet <= 0 || balance < bet) {
      alert("Insufficient demo credits! Use the Demo Faucet above.");
      return;
    }

    if (!deductCredits(bet)) return;

    const newDeck = createDeck();
    const p1 = newDeck.pop()!;
    const d1 = newDeck.pop()!;
    const p2 = newDeck.pop()!;
    const d2 = newDeck.pop()!;

    const initialPlayer = [p1, p2];
    const initialDealer = [d1, d2];

    setPlayerHand(initialPlayer);
    setDealerHand(initialDealer);
    setDeck(newDeck);
    setDealerHoleHidden(true);
    setResultMessage(null);
    setWinOutcome(null);

    // Check for natural Blackjack immediately
    const pVal = calculateHandValue(initialPlayer);
    const dVal = calculateHandValue(initialDealer);

    if (pVal.isBlackjack || dVal.isBlackjack) {
      // Reveal dealer hole card
      setDealerHoleHidden(false);
      const res = evaluateBlackjackGame(initialPlayer, initialDealer, bet);
      resolveGame(res.outcome, res.payout, initialDealer);
    } else {
      setGameState("PLAYER_TURN");
    }
  };

  const handleHit = () => {
    if (gameState !== "PLAYER_TURN" || deck.length === 0) return;
    const newDeck = [...deck];
    const newCard = newDeck.pop()!;
    const updatedPlayer = [...playerHand, newCard];

    setDeck(newDeck);
    setPlayerHand(updatedPlayer);

    const val = calculateHandValue(updatedPlayer);
    if (val.isBust) {
      // Player busts
      setDealerHoleHidden(false);
      const res = evaluateBlackjackGame(updatedPlayer, dealerHand, bet);
      resolveGame(res.outcome, res.payout, dealerHand);
    }
  };

  const handleStand = () => {
    if (gameState !== "PLAYER_TURN") return;
    setDealerHoleHidden(false);

    // Dealer takes cards until >= 17
    const dealerPlay = playDealerHand(dealerHand, [...deck]);
    setDealerHand(dealerPlay.dealerCards);

    const res = evaluateBlackjackGame(playerHand, dealerPlay.dealerCards, bet);
    resolveGame(res.outcome, res.payout, dealerPlay.dealerCards);
  };

  const handleDoubleDown = () => {
    if (gameState !== "PLAYER_TURN" || playerHand.length !== 2) return;
    if (balance < bet) {
      alert("Insufficient demo credits to double down!");
      return;
    }

    if (!deductCredits(bet)) return;
    const doubledBet = bet * 2;

    const newDeck = [...deck];
    const newCard = newDeck.pop()!;
    const updatedPlayer = [...playerHand, newCard];
    setDeck(newDeck);
    setPlayerHand(updatedPlayer);
    setDealerHoleHidden(false);

    const pVal = calculateHandValue(updatedPlayer);
    if (pVal.isBust) {
      resolveGame("PLAYER_BUST", 0, dealerHand);
      return;
    }

    const dealerPlay = playDealerHand(dealerHand, newDeck);
    setDealerHand(dealerPlay.dealerCards);
    const res = evaluateBlackjackGame(updatedPlayer, dealerPlay.dealerCards, doubledBet);
    resolveGame(res.outcome, res.payout, dealerPlay.dealerCards);
  };

  const resolveGame = (outcome: BlackjackResult, payout: number, finalDealerCards: Card[]) => {
    setGameState("RESOLVED");
    setWinOutcome(outcome);

    if (payout > 0) {
      addCredits(payout);
    }

    switch (outcome) {
      case "PLAYER_BLACKJACK":
        setResultMessage(`BLACKJACK! 3:2 Payout: +${payout.toFixed(2)} Demo Credits`);
        break;
      case "PLAYER_WIN":
        setResultMessage(`YOU WIN! +${payout.toFixed(2)} Demo Credits`);
        break;
      case "DEALER_WIN":
        setResultMessage(`Dealer wins this hand.`);
        break;
      case "PUSH":
        setResultMessage(`Push / Tie. Bet returned (${payout.toFixed(2)} Demo Credits).`);
        break;
      case "PLAYER_BUST":
        setResultMessage(`Bust! Hand over 21.`);
        break;
    }
  };

  const playerVal = calculateHandValue(playerHand);
  const dealerVal = calculateHandValue(dealerHoleHidden ? dealerHand.slice(0, 1) : dealerHand);

  return (
    <div className="mx-auto max-w-4xl rounded-3xl border border-amber-500/20 bg-slate-950 p-4 sm:p-6 shadow-2xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Blackjack <span className="text-amber-400">Pro</span>
            </h2>
            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              DEMO 99.5% RTP
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Dealer stands on 17. Blackjack pays 3 to 2. Double down allowed on initial deal.
          </p>
        </div>
      </div>

      {/* Blackjack Felt Table */}
      <div className="relative mb-6 flex flex-col items-center justify-between rounded-3xl border-2 border-emerald-900/60 bg-linear-to-b from-emerald-950 via-slate-950 to-emerald-950 p-6 sm:p-8 min-h-[380px] shadow-[inset_0_0_80px_rgba(6,78,59,0.3)]">
        {/* Dealer Hand Area */}
        <div className="flex flex-col items-center">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-bold tracking-wider text-emerald-400 uppercase">Dealer</span>
            {dealerHand.length > 0 && (
              <span className="rounded-full bg-slate-900/80 px-2 py-0.5 font-mono text-xs font-bold text-amber-300">
                {dealerHoleHidden ? `${dealerVal.total} + ?` : dealerVal.total}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            {dealerHand.map((card, i) => {
              const isHole = i === 1 && dealerHoleHidden;
              const isRed = card.suit === "♥" || card.suit === "♦";
              return (
                <div
                  key={i}
                  className={`flex h-24 w-16 sm:h-28 sm:w-20 flex-col justify-between rounded-xl border p-2 shadow-lg transition-transform ${
                    isHole
                      ? "border-amber-500/40 bg-linear-to-br from-amber-600 via-amber-700 to-amber-900 text-transparent"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {isHole ? (
                    <div className="flex h-full items-center justify-center font-bold text-amber-200 text-lg">
                      ★
                    </div>
                  ) : (
                    <>
                      <div className={`text-sm font-black ${isRed ? "text-red-600" : "text-slate-900"}`}>
                        {card.rank}
                      </div>
                      <div className={`text-center text-xl sm:text-2xl ${isRed ? "text-red-600" : "text-slate-900"}`}>
                        {card.suit}
                      </div>
                      <div className={`text-right text-xs font-black ${isRed ? "text-red-600" : "text-slate-900"}`}>
                        {card.rank}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Felt Announcement */}
        <div className="my-4 text-center">
          {resultMessage ? (
            <div
              className={`rounded-2xl px-6 py-3 text-base sm:text-lg font-black shadow-xl animate-fade-in ${
                winOutcome === "PLAYER_WIN" || winOutcome === "PLAYER_BLACKJACK"
                  ? "border border-amber-400 bg-amber-400/20 text-amber-300"
                  : winOutcome === "PUSH"
                  ? "border border-slate-600 bg-slate-800 text-slate-200"
                  : "border border-red-500/40 bg-red-950/60 text-red-300"
              }`}
            >
              {resultMessage}
            </div>
          ) : (
            <div className="text-xs font-bold tracking-widest text-emerald-600/70 uppercase">
              Blackjack Pays 3:2 · Dealer Must Stand On 17
            </div>
          )}
        </div>

        {/* Player Hand Area */}
        <div className="flex flex-col items-center">
          <div className="flex gap-2">
            {playerHand.map((card, i) => {
              const isRed = card.suit === "♥" || card.suit === "♦";
              return (
                <div
                  key={i}
                  className="flex h-24 w-16 sm:h-28 sm:w-20 flex-col justify-between rounded-xl border border-slate-300 bg-white p-2 shadow-lg"
                >
                  <div className={`text-sm font-black ${isRed ? "text-red-600" : "text-slate-900"}`}>
                    {card.rank}
                  </div>
                  <div className={`text-center text-xl sm:text-2xl ${isRed ? "text-red-600" : "text-slate-900"}`}>
                    {card.suit}
                  </div>
                  <div className={`text-right text-xs font-black ${isRed ? "text-red-600" : "text-slate-900"}`}>
                    {card.rank}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-bold tracking-wider text-emerald-400 uppercase">You</span>
            {playerHand.length > 0 && (
              <span className="rounded-full bg-slate-900/80 px-2 py-0.5 font-mono text-xs font-bold text-amber-300">
                {playerVal.total} {playerVal.isSoft ? "(Soft)" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-4">
        {/* Bet setting when not in round */}
        {gameState === "BETTING" || gameState === "RESOLVED" ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">Bet:</span>
            {[10, 25, 50, 100, 250].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setBet(amt)}
                className={`rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold transition ${
                  bet === amt
                    ? "border border-amber-400 bg-amber-400 text-slate-950"
                    : "border border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
                }`}
              >
                {amt}
              </button>
            ))}
          </div>
        ) : (
          <div className="font-mono text-xs text-slate-400">
            Current Stake: <span className="font-bold text-amber-300">{bet} Demo</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {gameState === "PLAYER_TURN" ? (
            <>
              <button
                type="button"
                onClick={handleHit}
                className="rounded-xl border border-slate-600 bg-slate-800 px-5 py-2.5 font-bold text-white shadow-md hover:bg-slate-700 active:scale-95"
              >
                HIT
              </button>
              <button
                type="button"
                onClick={handleStand}
                className="rounded-xl border border-amber-500 bg-linear-to-r from-amber-500 to-yellow-400 px-6 py-2.5 font-bold text-slate-950 shadow-md hover:from-amber-400 hover:to-yellow-300 active:scale-95"
              >
                STAND
              </button>
              {playerHand.length === 2 && balance >= bet && (
                <button
                  type="button"
                  onClick={handleDoubleDown}
                  className="rounded-xl border border-blue-500 bg-blue-600 px-4 py-2.5 font-bold text-white shadow-md hover:bg-blue-500 active:scale-95"
                >
                  DOUBLE
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={startDeal}
              className="rounded-xl border border-amber-400 bg-linear-to-r from-amber-500 to-yellow-400 px-8 py-2.5 font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-yellow-300 active:scale-95"
            >
              {gameState === "RESOLVED" ? "DEAL AGAIN" : "DEAL"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

