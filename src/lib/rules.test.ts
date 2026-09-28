import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { diceMultiplier, diceRoll, limboResult, roundFloat, sha256 } from "./fairness";
import { lineMultiplier, normalizeNumbers } from "./lottery-rules";
import { parseAmount } from "./money";
import { curpBirthDate, isValidCpf, isValidCurp, normalizeDocument, validateDocument } from "./kyc-rules";
import { fairProbabilities, footballMarkets } from "./pricing";
import { combinedOdds, evaluateBet, resolveSelection, validateMarket } from "./sports-rules";

const D = (v: number | string) => new Prisma.Decimal(v);

test("markets resolve from the final score", () => {
  const mk = (type: string, line: number | null = null, codes: string[] = []) => ({ type, line, codes });
  assert.equal(resolveSelection(mk("1X2"), "1", 2, 1), "WON");
  assert.equal(resolveSelection(mk("1X2"), "X", 1, 1), "WON");
  assert.equal(resolveSelection(mk("1X2"), "2", 2, 1), "LOST");
  assert.equal(resolveSelection(mk("DC"), "1X", 1, 1), "WON");
  assert.equal(resolveSelection(mk("DC"), "12", 1, 1), "LOST");
  assert.equal(resolveSelection(mk("DC"), "X2", 0, 2), "WON");
  assert.equal(resolveSelection(mk("ML"), "1", 101, 99), "WON");
  assert.equal(resolveSelection(mk("ML"), "1", 100, 100), "VOID");
  assert.equal(resolveSelection(mk("OU", 2.5), "OVER", 2, 1), "WON");
  assert.equal(resolveSelection(mk("OU", 2.5), "UNDER", 1, 1), "WON");
  assert.equal(resolveSelection(mk("OU", 3), "OVER", 2, 1), "VOID");
  assert.equal(resolveSelection(mk("OU", 215.5), "UNDER", 110, 106), "LOST");
  assert.equal(resolveSelection(mk("HCP", -1.5), "HOME", 2, 1), "LOST");
  assert.equal(resolveSelection(mk("HCP", -1.5), "AWAY", 2, 1), "WON");
  assert.equal(resolveSelection(mk("HCP", -1.5), "HOME", 3, 1), "WON");
  assert.equal(resolveSelection(mk("HCP", -1), "HOME", 2, 1), "VOID");
  assert.equal(resolveSelection(mk("HCP", 4.5), "HOME", 98, 102), "WON");
  assert.equal(resolveSelection(mk("BTTS"), "YES", 1, 0), "LOST");
  assert.equal(resolveSelection(mk("BTTS"), "NO", 0, 0), "WON");
  const cs = mk("CS", null, ["1-0", "2-1", "OTHER"]);
  assert.equal(resolveSelection(cs, "2-1", 2, 1), "WON");
  assert.equal(resolveSelection(cs, "1-0", 2, 1), "LOST");
  assert.equal(resolveSelection(cs, "OTHER", 4, 4), "WON");
  assert.equal(resolveSelection(cs, "OTHER", 1, 0), "LOST");
});

test("market definitions are validated", () => {
  assert.equal(validateMarket("OU", 2.5, ["OVER", "UNDER"]), null);
  assert.equal(validateMarket("OU", null, ["OVER", "UNDER"]), "invalid_market");
  assert.equal(validateMarket("OU", 2.3, ["OVER", "UNDER"]), "invalid_market");
  assert.equal(validateMarket("1X2", 1, ["1", "X", "2"]), "invalid_market");
  assert.equal(validateMarket("1X2", null, ["1", "2"]), "invalid_market");
  assert.equal(validateMarket("CS", null, ["1-0", "0-0", "OTHER"]), null);
  assert.equal(validateMarket("CS", null, ["1-0", "banana"]), "invalid_market");
  assert.equal(validateMarket("XYZ", null, ["A", "B"]), "invalid_market");
});

test("Poisson pricing reproduces the input and is consistent", () => {
  const markets = footballMarkets({ odds1X2: [2.25, 3.2, 3.1], oddsOU25: [2.0, 1.8] });
  const byKey = new Map(markets.map((m) => [`${m.type}:${m.line}`, m]));
  for (const m of markets)
    assert.equal(
      validateMarket(
        m.type,
        m.line,
        m.selections.map((s) => s.code),
      ),
      null,
      m.type,
    );
  const oddsOf = (key: string, code: string) => byKey.get(key)!.selections.find((s) => s.code === code)!.odds;
  // Over 1.5 is likelier than over 2.5, which is likelier than over 3.5.
  assert.ok(oddsOf("OU:1.5", "OVER") < oddsOf("OU:2.5", "OVER"));
  assert.ok(oddsOf("OU:2.5", "OVER") < oddsOf("OU:3.5", "OVER"));
  // Double chance 1X must be shorter than the home win alone.
  assert.ok(oddsOf("DC:null", "1X") < 2.25);
  // Every market carries a margin: implied probabilities add up to more than 100%.
  for (const m of markets) {
    const book = m.selections.reduce((a, s) => a + 1 / s.odds, 0);
    assert.ok(book > 1, `${m.type}:${m.line} book ${book}`);
  }
  assert.deepEqual(fairProbabilities([2, 2]), [0.5, 0.5]);
});

test("CPF and CURP validation", () => {
  assert.equal(isValidCpf("52998224725"), true);
  assert.equal(isValidCpf("52998224724"), false);
  assert.equal(isValidCpf("11111111111"), false);
  assert.equal(normalizeDocument("CPF", "529.982.247-25"), "52998224725");
  assert.equal(isValidCurp("GODE561231HDFNRS09"), false);
  const curp = "HEGG560427MVZRRL04";
  assert.equal(isValidCurp(curp), true);
  assert.equal(curpBirthDate(curp), "1956-04-27");
  assert.equal(validateDocument("CURP", curp, new Date("1956-04-27")), null);
  assert.equal(validateDocument("CURP", curp, new Date("1990-01-01")), "curp_birthdate_mismatch");
  assert.equal(validateDocument("CPF", "123", new Date()), "invalid_cpf");
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
  const acca = evaluateBet(stake, [
    { odds: D("2.25"), result: "WON" },
    { odds: D("1.9"), result: "WON" },
  ]);
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
