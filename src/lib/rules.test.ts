import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { lineMultiplier, normalizeNumbers } from "./lottery-rules";
import { resultFromPicks, upcomingDraws, zonedDate, zonedToUtc } from "./lottery-schedule";
import { parseAmount } from "./money";
import { cancellable, startOfBrDay } from "./orders-rules";
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

test("amount parsing accepts comma or dot decimals", () => {
  assert.equal(parseAmount("12,50")!.toString(), "12.5");
  assert.equal(parseAmount("100")!.toString(), "100");
  assert.equal(parseAmount("-5"), null);
  assert.equal(parseAmount("1.234"), null);
  assert.equal(parseAmount("0"), null);
});

test("state draw times are Eastern Time, including daylight saving", () => {
  assert.equal(zonedToUtc("2026-07-01", "14:30").toISOString(), "2026-07-01T18:30:00.000Z"); // EDT, UTC-4
  assert.equal(zonedToUtc("2026-12-01", "14:30").toISOString(), "2026-12-01T19:30:00.000Z"); // EST, UTC-5
  assert.equal(zonedToUtc("2026-11-01", "23:34").toISOString(), "2026-11-02T04:34:00.000Z"); // DST ended that morning
  assert.equal(zonedDate(new Date("2026-09-29T03:00:00Z")), "2026-09-28"); // 11pm ET still the 28th
});

test("upcoming draws: NY, FL, GA sessions in order, closing before the draw", () => {
  const now = new Date("2026-09-28T17:00:00Z"); // 1:00 pm ET
  const draws = upcomingDraws(now, 0);
  // Today after 1pm ET: FL midday 13:30, NY 14:30, GA 18:59, FL 21:45, NY 22:30, GA 23:34 (GA 12:29 has passed).
  assert.deepEqual(
    draws.map((d) => `${d.lottery}-${d.session}`),
    ["FL-MIDDAY", "NY-MIDDAY", "GA-EVENING", "FL-EVENING", "NY-EVENING", "GA-NIGHT"],
  );
  for (const d of draws) assert.ok(d.closesAt < d.drawAt && d.drawAt > now);
  assert.equal(upcomingDraws(now, 2).length, 6 + 7 + 7);
});

test("borlette lots come from Pick 3 and Pick 4", () => {
  assert.deepEqual(resultFromPicks("347", "1285"), { first: "347", second: "12", third: "85" });
  assert.equal(resultFromPicks("34", "1285"), null);
  assert.equal(resultFromPicks("347", "12a5"), null);
});

test("PIX BR Code matches the Banco Central example and validates keys", async () => {
  const { crc16, normalizePixKey, pixBrCode, isValidCnpj } = await import("./pix");
  // Example from the BCB "Manual de Padrões para Iniciação do Pix".
  const body =
    "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
  assert.equal(crc16(body), "1D3D");
  const code = pixBrCode({ key: "123e4567-e12b-12d1-a456-426655440000", name: "Fulano de Tal", city: "BRASILIA" });
  assert.equal(code, body + "1D3D");
  const withAmount = pixBrCode({
    key: "a@b.com",
    name: "São João",
    city: "Brasília",
    amount: "100.50",
    txid: "PJ-7K3M9Q",
  });
  assert.match(withAmount, /5406100\.50/);
  assert.match(withAmount, /5908Sao Joao/);
  assert.match(withAmount, /62120508PJ7K3M9Q/);
  assert.equal(withAmount.slice(-4), crc16(withAmount.slice(0, -4)));

  assert.equal(normalizePixKey("CPF", "529.982.247-25"), "52998224725");
  assert.equal(normalizePixKey("CPF", "529.982.247-24"), null);
  assert.equal(isValidCnpj("11222333000181"), true);
  assert.equal(normalizePixKey("CNPJ", "11.222.333/0001-81"), "11222333000181");
  assert.equal(normalizePixKey("CNPJ", "11.222.333/0001-80"), null);
  assert.equal(normalizePixKey("EMAIL", " Jogador@Mail.com "), "jogador@mail.com");
  assert.equal(normalizePixKey("PHONE", "(11) 98765-4321"), "+5511987654321");
  assert.equal(normalizePixKey("PHONE", "123"), null);
  assert.equal(normalizePixKey("EVP", "123E4567-E12B-12D1-A456-426655440000"), "123e4567-e12b-12d1-a456-426655440000");
});

test("service codes, Brazilian phones and PIX keys typed in WhatsApp", async () => {
  const { detectPixKey, findOrderCode, newOrderCode, normalizeBrPhone, formatPhone } = await import("./orders-rules");
  const code = newOrderCode();
  assert.match(code, /^PJ[2-9A-HJ-NP-Z]{6}$/);
  assert.equal(findOrderCode(`meu código é ${code.toLowerCase()} obrigado`), code);
  assert.equal(findOrderCode("pj-7k3m9q"), "PJ7K3M9Q");
  assert.equal(findOrderCode("PJ0O1I00"), null);

  assert.equal(normalizeBrPhone("(11) 98765-4321"), "5511987654321");
  assert.equal(normalizeBrPhone("+55 21 3456-7890"), "552134567890");
  assert.equal(normalizeBrPhone("123"), null);
  assert.equal(formatPhone("5511987654321"), "+55 (11) 98765-4321");

  assert.deepEqual(detectPixKey("minha chave é 529.982.247-25"), { type: "CPF", key: "52998224725" });
  assert.deepEqual(detectPixKey("Maria@Email.com."), { type: "EMAIL", key: "maria@email.com" });
  assert.deepEqual(detectPixKey("(11) 98765-4321"), { type: "PHONE", key: "+5511987654321" });
  assert.deepEqual(detectPixKey("11.222.333/0001-81"), { type: "CNPJ", key: "11222333000181" });
  assert.equal(detectPixKey("123e4567-e89b-12d3-a456-426614174000")?.type, "EVP");
  assert.equal(detectPixKey("oi, tudo bem?"), null);
});

test("Evolution API webhook messages are parsed and filtered", async () => {
  const { parseEvolutionMessage } = await import("./orders-rules");
  const base = { event: "messages.upsert", instance: "paryajnet" };
  const text = parseEvolutionMessage({
    ...base,
    data: {
      key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: false, id: "ABC" },
      pushName: "Maria",
      message: { conversation: "PJ7K3M9Q" },
    },
  });
  assert.deepEqual(text, { id: "ABC", phone: "5511987654321", name: "Maria", text: "PJ7K3M9Q", media: null });
  const image = parseEvolutionMessage({
    event: "MESSAGES_UPSERT",
    data: {
      key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: false, id: "IMG" },
      message: { imageMessage: { mimetype: "image/jpeg", caption: "comprovante" }, base64: "aGVsbG8=" },
    },
  });
  assert.deepEqual(image?.media, { type: "IMAGE", mimetype: "image/jpeg", base64: "aGVsbG8=" });
  assert.equal(image?.text, "comprovante");
  const pdf = parseEvolutionMessage({
    ...base,
    data: {
      key: { remoteJid: "5511987654321@s.whatsapp.net", id: "DOC" },
      message: { documentMessage: { mimetype: "application/pdf" } },
    },
  });
  assert.equal(pdf?.media?.type, "DOCUMENT");
  // Ignored: our own messages, groups, other events.
  assert.equal(
    parseEvolutionMessage({
      ...base,
      data: { key: { remoteJid: "5511987654321@s.whatsapp.net", fromMe: true }, message: { conversation: "x" } },
    }),
    null,
  );
  assert.equal(
    parseEvolutionMessage({ ...base, data: { key: { remoteJid: "12036@g.us" }, message: { conversation: "x" } } }),
    null,
  );
  assert.equal(parseEvolutionMessage({ event: "connection.update", data: {} }), null);
});

test("The Odds API events become our markets (consensus odds, lines, margin)", async () => {
  const { consensusPrice, marketsFromApi, scoreOf } = await import("./odds-api");
  assert.equal(consensusPrice([2.1, 2.2, 2.3], 0), 2.2);
  assert.equal(consensusPrice([2.0, 2.2], 0), 2.1);
  assert.equal(consensusPrice([3.0], 5), 2.9); // 1 + 2 × 0.95
  assert.equal(consensusPrice([], 0), null);

  const book = (h: number, d: number, a: number, over: number, under: number, point = 2.5) => ({
    key: "b",
    markets: [
      {
        key: "h2h",
        outcomes: [
          { name: "Flamengo", price: h },
          { name: "Draw", price: d },
          { name: "Palmeiras", price: a },
        ],
      },
      {
        key: "totals",
        outcomes: [
          { name: "Over", price: over, point },
          { name: "Under", price: under, point },
        ],
      },
    ],
  });
  const soccer = {
    id: "e1",
    sport_key: "soccer_brazil_campeonato",
    sport_title: "Brasileirão Série A",
    commence_time: "2026-10-04T19:00:00Z",
    home_team: "Flamengo",
    away_team: "Palmeiras",
    bookmakers: [
      book(2.2, 3.3, 3.2, 2.0, 1.8),
      book(2.3, 3.2, 3.1, 2.05, 1.78),
      book(2.25, 3.25, 3.3, 1.95, 1.85),
      book(2.2, 3.3, 3.2, 1.5, 2.5, 1.5),
    ],
  };
  const markets = marketsFromApi(soccer, 0);
  const one = markets.find((m) => m.type === "1X2")!;
  assert.deepEqual(one.selections, [
    { code: "1", odds: 2.22 }, // median of 2.2, 2.3, 2.25, 2.2
    { code: "X", odds: 3.27 },
    { code: "2", odds: 3.2 },
  ]);
  const ou25 = markets.filter((m) => m.type === "OU" && m.line === 2.5);
  assert.equal(ou25.length, 1, "bookmaker 2.5 total replaces the model's");
  assert.deepEqual(ou25[0].selections, [
    { code: "OVER", odds: 2 },
    { code: "UNDER", odds: 1.8 },
  ]);
  // The 1.5 line has only one bookmaker, so it comes from the model instead.
  assert.ok(markets.some((m) => m.type === "OU" && m.line === 1.5));
  assert.ok(
    ["DC", "BTTS", "HCP", "CS"].every((t) => markets.some((m) => m.type === t)),
    "derived markets",
  );

  const nba = {
    id: "e2",
    sport_key: "basketball_nba",
    sport_title: "NBA",
    commence_time: "2026-10-04T23:00:00Z",
    home_team: "Lakers",
    away_team: "Celtics",
    bookmakers: [1, 2].map(() => ({
      key: "b",
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: "Lakers", price: 2.3 },
            { name: "Celtics", price: 1.65 },
          ],
        },
        {
          key: "spreads",
          outcomes: [
            { name: "Lakers", price: 1.91, point: 4.5 },
            { name: "Celtics", price: 1.91, point: -4.5 },
          ],
        },
        {
          key: "totals",
          outcomes: [
            { name: "Over", price: 1.9, point: 226.5 },
            { name: "Under", price: 1.9, point: 226.5 },
          ],
        },
      ],
    })),
  };
  assert.deepEqual(
    marketsFromApi(nba, 0).map((m) => `${m.type}:${m.line}`),
    ["ML:null", "HCP:4.5", "OU:226.5"],
  );
  assert.deepEqual(marketsFromApi({ ...soccer, bookmakers: [] }, 0), []);

  assert.deepEqual(
    scoreOf({
      id: "x",
      sport_key: "s",
      commence_time: "",
      completed: true,
      home_team: "A",
      away_team: "B",
      scores: [
        { name: "B", score: "1" },
        { name: "A", score: "2" },
      ],
    }),
    { home: 2, away: 1 },
  );
  assert.equal(
    scoreOf({
      id: "x",
      sport_key: "s",
      commence_time: "",
      completed: false,
      home_team: "A",
      away_team: "B",
      scores: null,
    }),
    null,
  );
});

test("agents can cancel only their own fresh cash sales", () => {
  const now = new Date("2026-09-28T15:00:00Z");
  const sale = {
    channel: "AGENT",
    status: "CONFIRMED",
    soldById: "a1",
    createdAt: new Date("2026-09-28T14:55:00Z"),
    payBy: new Date("2026-09-28T18:00:00Z"),
  };
  assert.equal(cancellable(sale, "a1", now), true);
  assert.equal(cancellable(sale, "a2", now), false, "another agent");
  assert.equal(cancellable({ ...sale, channel: "ONLINE" }, "a1", now), false, "online service");
  assert.equal(cancellable({ ...sale, status: "WON" }, "a1", now), false, "already settled");
  assert.equal(cancellable({ ...sale, createdAt: new Date("2026-09-28T14:49:00Z") }, "a1", now), false, "too old");
  assert.equal(cancellable({ ...sale, payBy: new Date("2026-09-28T14:59:00Z") }, "a1", now), false, "closed");
});

test("the cash day starts at midnight in Brasília", () => {
  assert.equal(startOfBrDay(new Date("2026-09-28T15:00:00Z")).toISOString(), "2026-09-28T03:00:00.000Z");
  // 01:00 UTC is still the previous day in Brasília (22:00).
  assert.equal(startOfBrDay(new Date("2026-09-29T01:00:00Z")).toISOString(), "2026-09-28T03:00:00.000Z");
  assert.equal(startOfBrDay(new Date("2026-09-29T03:00:00Z")).toISOString(), "2026-09-29T03:00:00.000Z");
});
