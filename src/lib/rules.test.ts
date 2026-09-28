import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { diceMultiplier, diceRoll, limboResult, roundFloat, sha256 } from "./fairness";
import { lineMultiplier, normalizeNumbers } from "./lottery-rules";
import { parseAmount } from "./money";
import { combinedOdds, evaluateBet, resolveSelection } from "./sports-rules";

const D = (v: number | string) => new Prisma.Decimal(v);

test("1X2, over/under and BTTS resolve from the score", () => {
  assert.equal(resolveSelection("1X2", "1", 2, 1), "WON");
  assert.equal(resolveSelection("1X2", "X", 1, 1), "WON");
  assert.equal(resolveSelection("1X2", "2", 2, 1), "LOST");
  assert.equal(resolveSelection("OU25", "OVER", 2, 1), "WON");
  assert.equal(resolveSelection("OU25", "UNDER", 1, 1), "WON");
  assert.equal(resolveSelection("BTTS", "YES", 1, 0), "LOST");
  assert.equal(resolveSelection("BTTS", "NO", 0, 0), "WON");
});

test("accumulator settlement", () => {
  const stake = D(10);
  assert.deepEqual(
    evaluateBet(stake, [
      { odds: D(2), result: "WON" },
      { odds: D(3), result: "PENDING" },
    ]).status,
    "OPEN",
  );
  assert.equal(
    evaluateBet(stake, [
      { odds: D(2), result: "LOST" },
      { odds: D(3), result: "PENDING" },
    ]).status,
    "LOST",
  );
  const won = evaluateBet(stake, [
    { odds: D("2.5"), result: "WON" },
    { odds: D(3), result: "VOID" },
  ]);
  assert.equal(won.status, "WON");
  assert.equal(won.payout!.toString(), "25");
  const acca = evaluateBet(stake, [{ odds: D("2.25"), result: "WON" }, { odds: D("1.9"), result: "WON" }]);
  assert.equal(acca.payout!.toString(), "42.7", "payout must match potential win (odds 4.275 -> 4.27)");
  const voided = evaluateBet(stake, [{ odds: D(2), result: "VOID" }]);
  assert.equal(voided.status, "VOID");
  assert.equal(voided.payout!.toString(), "10");
  assert.equal(combinedOdds([D("1.55"), D("2.25"), D("1.9")]).toString(), "6.62");
});

test("borlette, loto 3 and mariage payouts", () => {
  const r = { first: "347", second: "12", third: "85" };
  assert.equal(lineMultiplier("BORLETTE", "47", r), 50);
  assert.equal(lineMultiplier("BORLETTE", "12", r), 20);
  assert.equal(lineMultiplier("BORLETTE", "85", r), 10);
  assert.equal(lineMultiplier("BORLETTE", "34", r), 0);
  assert.equal(lineMultiplier("BORLETTE", "12", { first: "112", second: "12", third: "12" }), 80);
  assert.equal(lineMultiplier("LOTO3", "347", r), 500);
  assert.equal(lineMultiplier("LOTO3", "348", r), 0);
  assert.equal(lineMultiplier("MARIAGE", "47-85", r), 1000);
  assert.equal(lineMultiplier("MARIAGE", "47-86", r), 0);
  assert.equal(normalizeNumbers("MARIAGE", "12 x 34"), "12-34");
  assert.equal(normalizeNumbers("MARIAGE", "12-12"), null);
  assert.equal(normalizeNumbers("BORLETTE", "7"), null);
  assert.equal(normalizeNumbers("LOTO3", "007"), "007");
});

test("provably fair outputs are deterministic and in range", () => {
  const seed = "a".repeat(64);
  assert.equal(roundFloat(seed, "client", 0), roundFloat(seed, "client", 0));
  assert.notEqual(roundFloat(seed, "client", 0), roundFloat(seed, "client", 1));
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  for (let n = 0; n < 1000; n++) {
    const f = roundFloat(seed, "client", n);
    assert.ok(f >= 0 && f < 1);
    const roll = diceRoll(f);
    assert.ok(roll >= 0 && roll <= 99.99);
    assert.ok(limboResult(f) >= 1);
  }
  assert.equal(diceMultiplier(50), 1.98);
});

test("casino RTP is about 99%", () => {
  const seed = "b".repeat(64);
  const N = 200_000;
  let dice = 0;
  let limbo = 0;
  for (let n = 0; n < N; n++) {
    const f = roundFloat(seed, "rtp", n);
    if (diceRoll(f) < 50) dice += diceMultiplier(50);
    if (limboResult(f) >= 2) limbo += 2;
  }
  assert.ok(Math.abs(dice / N - 0.99) < 0.01, `dice RTP ${dice / N}`);
  assert.ok(Math.abs(limbo / N - 0.99) < 0.01, `limbo RTP ${limbo / N}`);
});

test("amount parsing accepts comma or dot decimals", () => {
  assert.equal(parseAmount("12,50")!.toString(), "12.5");
  assert.equal(parseAmount("100")!.toString(), "100");
  assert.equal(parseAmount("-5"), null);
  assert.equal(parseAmount("1.234"), null);
  assert.equal(parseAmount("0"), null);
});
