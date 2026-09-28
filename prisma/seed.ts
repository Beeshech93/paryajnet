import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const D = (v: number | string) => new Prisma.Decimal(v);
const hours = (h: number) => new Date(Date.now() + h * 3_600_000);

const EVENTS: [string, string, string, number, [number, number, number]][] = [
  ["Brasileirão Série A", "Flamengo", "Palmeiras", 3, [2.25, 3.2, 3.1]],
  ["Brasileirão Série A", "Corinthians", "São Paulo", 5, [2.6, 3.0, 2.8]],
  ["Brasileirão Série A", "Grêmio", "Internacional", 26, [2.4, 3.1, 2.95]],
  ["Liga MX", "América", "Chivas", 8, [1.85, 3.5, 4.2]],
  ["Liga MX", "Tigres UANL", "Monterrey", 30, [2.3, 3.25, 3.0]],
  ["Liga MX", "Cruz Azul", "Pumas UNAM", 50, [2.05, 3.3, 3.6]],
  ["Ligue 1", "Paris Saint-Germain", "Olympique de Marseille", 28, [1.55, 4.3, 5.5]],
  ["Premier League", "Arsenal", "Chelsea", 52, [1.95, 3.6, 3.8]],
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
  if (!env.SEED_ADMIN_PASSWORD || !env.SEED_PLAYER_PASSWORD) throw new Error("Set SEED_* variables in .env");

  await upsertUser(env.SEED_ADMIN_EMAIL!, env.SEED_ADMIN_PASSWORD, "Admin", "ADMIN", "BRL");
  const player = await upsertUser(env.SEED_PLAYER_EMAIL!, env.SEED_PLAYER_PASSWORD, "Jogador Demo", "USER", "BRL");
  await fund(player.id, "BRL", 500);
  await fund(player.id, "MXN", 2000);

  if ((await prisma.event.count()) === 0) {
    for (const [league, home, away, inHours, [o1, oX, o2]] of EVENTS) {
      const prices: Record<string, number> = { "1": o1, X: oX, "2": o2, OVER: 1.9, UNDER: 1.9, YES: 1.8, NO: 1.95 };
      await prisma.event.create({
        data: {
          sport: "football",
          league,
          homeTeam: home,
          awayTeam: away,
          startsAt: hours(inHours),
          markets: {
            create: [
              ["1X2", ["1", "X", "2"]],
              ["OU25", ["OVER", "UNDER"]],
              ["BTTS", ["YES", "NO"]],
            ].map(([type, codes]) => ({
              type: type as string,
              selections: { create: (codes as string[]).map((code) => ({ code, odds: D(prices[code]) })) },
            })),
          },
        },
      });
    }
  }

  if ((await prisma.lotteryDraw.count()) === 0) {
    await prisma.lotteryDraw.createMany({
      data: [
        { name: "Port-au-Prince · Midi", closesAt: hours(4) },
        { name: "Rio · Noite", closesAt: hours(10) },
        { name: "CDMX · Noche", closesAt: hours(34) },
        {
          name: "Port-au-Prince · Soir",
          closesAt: hours(-20),
          status: "SETTLED",
          first: "347",
          second: "12",
          third: "85",
        },
      ],
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
