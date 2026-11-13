import assert from "node:assert/strict";
import { test } from "node:test";
import {
  REAL_MONEY_ENABLED,
  REAL_SPORTSBOOK_ENABLED,
  REAL_CASINO_ENABLED,
  REAL_DEPOSITS_ENABLED,
  REAL_WITHDRAWALS_ENABLED,
  CASH_PRIZES_ENABLED,
  assertDemoOnly,
  blockRealMoneyDeposit,
  blockRealMoneyWithdrawal,
  assertDemoWagerOnly,
  RealMoneyDisabledError,
  DEMO_POLICY_CONFIG,
} from "./compliance";

test("compliance: mandatory demo-only configuration is strictly disabled", () => {
  assert.equal(REAL_MONEY_ENABLED, false, "REAL_MONEY_ENABLED must be false");
  assert.equal(REAL_SPORTSBOOK_ENABLED, false, "REAL_SPORTSBOOK_ENABLED must be false");
  assert.equal(REAL_CASINO_ENABLED, false, "REAL_CASINO_ENABLED must be false");
  assert.equal(REAL_DEPOSITS_ENABLED, false, "REAL_DEPOSITS_ENABLED must be false");
  assert.equal(REAL_WITHDRAWALS_ENABLED, false, "REAL_WITHDRAWALS_ENABLED must be false");
  assert.equal(CASH_PRIZES_ENABLED, false, "CASH_PRIZES_ENABLED must be false");
  
  // Runtime assertion must pass
  assert.doesNotThrow(() => assertDemoOnly());
});

test("compliance: deposit operations are strictly blocked with RealMoneyDisabledError", () => {
  assert.throws(
    () => blockRealMoneyDeposit(100, "MXN"),
    (err: unknown) => {
      assert.ok(err instanceof RealMoneyDisabledError);
      assert.equal(err.code, "REAL_MONEY_OPERATIONS_DISABLED");
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /prohibited/i);
      return true;
    }
  );

  assert.throws(
    () => blockRealMoneyDeposit(500, "HTG"),
    RealMoneyDisabledError
  );
});

test("compliance: withdrawal operations are strictly blocked with RealMoneyDisabledError", () => {
  assert.throws(
    () => blockRealMoneyWithdrawal(250, "bank_transfer"),
    (err: unknown) => {
      assert.ok(err instanceof RealMoneyDisabledError);
      assert.match(err.message, /cannot be withdrawn/i);
      return true;
    }
  );
});

test("compliance: real cash wager requests are strictly prohibited", () => {
  assert.throws(
    () => assertDemoWagerOnly(true),
    RealMoneyDisabledError
  );

  assert.doesNotThrow(() => assertDemoWagerOnly(false));
});

test("compliance: policy config targets Mexico, Haiti, and Global demo currencies", () => {
  assert.equal(DEMO_POLICY_CONFIG.isDemoMode, true);
  assert.equal(DEMO_POLICY_CONFIG.badgeText, "DEMO MODE");
  
  const currencyCodes = DEMO_POLICY_CONFIG.supportedCurrencies.map((c) => c.code);
  assert.ok(currencyCodes.includes("MXN"), "Must support Mexico (MXN)");
  assert.ok(currencyCodes.includes("HTG"), "Must support Haiti (HTG)");
  assert.ok(currencyCodes.includes("USD"), "Must support USD");
});

