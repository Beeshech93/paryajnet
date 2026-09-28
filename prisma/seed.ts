import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
import { basketballMarkets, footballMarkets } from "../src/lib/pricing";
import { createEvent } from "../src/lib/sports";
import { ensureUpcomingDraws } from "../src/lib/lottery";
import { LOTTERIES, resultFromPicks, zonedDate, zonedToUtc } from "../src/lib/lottery-schedule";

const prisma = new PrismaClient();
const D = (v: number | string) => new Prisma.Decimal(v);
const hours = (h: number) => new Date(Date.now() + h * 3_600_000);

const FOOTBALL: [string, string, string, number, [number, number, number], [number, number]][] = [
  ["Brasileirão Série A", "Flamengo", "Palmeiras", 3, [2.25, 3.2, 3.1], [2.0, 1.8]],
  ["Brasileirão Série A", "Corinthians", "São Paulo", 5, [2.6, 3.0, 2.8], [2.2, 1.65]],
  ["Brasileirão Série A", "Grêmio", "Internacional", 26, [2.4, 3.1, 2.95], [2.1, 1.72]],
  ["Liga MX", "Tigres UANL", "Monterrey", 30, [2.3, 3.25, 3.0], [1.95, 1.85]],
  ["Liga MX", "Cruz Azul", "Pumas UNAM", 50, [2.05, 3.3, 3.6], [1.9, 1.9]],
  ["Ligue 1", "Paris Saint-Germain", "Olympique de Marseille", 28, [1.55, 4.3, 5.5], [1.55, 2.4]],
  ["Premier League", "Arsenal", "Chelsea", 52, [1.95, 3.6, 3.8], [1.75, 2.05]],
];

const BASKETBALL: [string, string, string, number, [number, number], number, number][] = [
  ["NBA", "Los Angeles Lakers", "Boston Celtics", 9, [2.3, 1.62], 4.5, 226.5],
  ["NBB", "Flamengo Basquete", "Franca", 27, [1.7, 2.15], -3.5, 164.5],
  ["LNBP", "Fuerza Regia", "Diablos Rojos", 31, [1.55, 2.45], -5.5, 171.5],
];

async function upsertUser(email: string, password: string, name: string, role: "USER" | "ADMIN", currency: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      role,
      preferredCurrency: currency,
      birthDate: new Date("1990-05-15"),
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
}

async function fund(userId: string, currency: string, amount: number) {
  const wallet = await prisma.wallet.upsert({
    where: { userId_currency: { userId, currency } },
    create: { userId, currency },
    update: {},
  });
  if (wallet.balance.gt(0)) return;
  const updated = await prisma.wallet.update({ where: { id: wallet.id }, data: { balance: D(amount) } });
  await prisma.transaction.create({
    data: {
      walletId: wallet.id,
      type: "ADJUSTMENT",
      amount: D(amount),
      balanceAfter: updated.balance,
      reference: "seed",
    },
  });
}

async function main() {
  const env = process.env;
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) throw new Error("Set SEED_ADMIN_* variables");
  await upsertUser(env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD, "Admin", "ADMIN", "BRL");

  // Demo player with play money: development only.
  if (env.SEED_PLAYER_EMAIL && env.SEED_PLAYER_PASSWORD) {
    const player = await upsertUser(env.SEED_PLAYER_EMAIL, env.SEED_PLAYER_PASSWORD, "Jogador Demo", "USER", "BRL");
    await fund(player.id, "BRL", 500);
    await fund(player.id, "MXN", 2000);
  }

  if ((await prisma.event.count()) === 0) {
    for (const [league, home, away, inHours, [o1, oX, o2], ou] of FOOTBALL) {
      await createEvent({
        sport: "football",
        league,
        homeTeam: home,
        awayTeam: away,
        startsAt: hours(inHours),
        markets: footballMarkets({ odds1X2: [o1, oX, o2], oddsOU25: ou }),
      });
    }
    for (const [league, home, away, inHours, ml, spread, total] of BASKETBALL) {
      await createEvent({
        sport: "basketball",
        league,
        homeTeam: home,
        awayTeam: away,
        startsAt: hours(inHours),
        markets: basketballMarkets({ oddsML: ml, spread, total }),
      });
    }
    // One match already in play, to demo live betting.
    const live = await createEvent({
      sport: "football",
      league: "Liga MX",
      homeTeam: "América",
      awayTeam: "Chivas",
      startsAt: hours(-0.6),
      // Pre-match derived prices (correct score, handicaps, other totals) would ignore the current score.
      markets: footballMarkets({ odds1X2: [1.45, 4.2, 7.5], oddsOU25: [1.7, 2.1] }).filter(
        (m) => ["1X2", "BTTS"].includes(m.type) || (m.type === "OU" && m.line === 2.5),
      ),
    });
    await prisma.event.update({
      where: { id: live.id },
      data: { status: "LIVE", homeScore: 1, awayScore: 0, clock: "34'" },
    });
  }

  if ((await prisma.lotteryDraw.count()) === 0) {
    await ensureUpcomingDraws();
    // Two past draws with official-style results, to show the results list.
    const yesterday = zonedDate(new Date(Date.now() - 24 * 3_600_000));
    for (const [lottery, session, pick3, pick4] of [
      ["NY", "EVENING", "347", "1285"],
      ["GA", "MIDDAY", "902", "4417"],
    ] as const) {
      const hm = (LOTTERIES[lottery].sessions as Record<string, string>)[session];
      const drawAt = zonedToUtc(yesterday, hm);
      await prisma.lotteryDraw.create({
        data: {
          name: `${LOTTERIES[lottery].name} · ${session}`,
          lottery,
          session,
          drawAt,
          closesAt: new Date(drawAt.getTime() - 10 * 60_000),
          status: "SETTLED",
          pick3,
          pick4,
          ...resultFromPicks(pick3, pick4)!,
        },
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
