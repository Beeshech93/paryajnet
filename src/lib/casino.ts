import { prisma, type Tx } from "./db";
import { CURRENCY_LIMITS, Decimal, roundPayout } from "./money";
import {
  DICE_MAX_TARGET,
  DICE_MIN_TARGET,
  diceMultiplier,
  diceRoll,
  LIMBO_MAX_TARGET,
  LIMBO_MIN_TARGET,
  limboResult,
  newClientSeed,
  newServerSeed,
  roundFloat,
} from "./fairness";
import { AppError, type Currency } from "./types";
import { credit, debit, getOrCreateWallet } from "./wallet";

export type CasinoGame = "DICE" | "LIMBO";

async function activeSeed(tx: Tx, userId: string) {
  const seed = await tx.casinoSeed.findFirst({ where: { userId, active: true } });
  if (seed) return seed;
  return tx.casinoSeed.create({ data: { userId, clientSeed: newClientSeed(), ...newServerSeed() } });
}

/** Public view of the player's fairness state; never exposes the active server seed. */
export async function getFairnessState(userId: string) {
  const [active, previous] = await prisma.$transaction(async (tx) => [
    await activeSeed(tx, userId),
    await tx.casinoSeed.findFirst({ where: { userId, active: false }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    serverSeedHash: active.serverSeedHash,
    clientSeed: active.clientSeed,
    nonce: active.nonce,
    previous: previous
      ? {
          serverSeed: previous.serverSeed,
          serverSeedHash: previous.serverSeedHash,
          clientSeed: previous.clientSeed,
          nonce: previous.nonce,
        }
      : null,
  };
}

/** Reveal the current server seed and start a new pair. */
export async function rotateSeed(userId: string, clientSeed?: string) {
  const next = clientSeed?.trim() || newClientSeed();
  if (!/^[\w-]{1,64}$/.test(next)) throw new AppError("invalid_client_seed");
  await prisma.$transaction(async (tx) => {
    await tx.casinoSeed.updateMany({ where: { userId, active: true }, data: { active: false } });
    await tx.casinoSeed.create({ data: { userId, clientSeed: next, ...newServerSeed() } });
  });
}

export async function playCasino(userId: string, currency: Currency, game: CasinoGame, stake: Decimal, target: number) {
  const limits = CURRENCY_LIMITS[currency];
  if (stake.lt(limits.minStake) || stake.gt(limits.maxStake)) {
    throw new AppError("stake_out_of_range", { min: limits.minStake, max: limits.maxStake });
  }

  let multiplier: number;
  if (game === "DICE") {
    if (!(target >= DICE_MIN_TARGET && target <= DICE_MAX_TARGET)) throw new AppError("invalid_target");
    target = Math.round(target * 100) / 100;
    multiplier = diceMultiplier(target);
  } else {
    if (!(target >= LIMBO_MIN_TARGET && target <= LIMBO_MAX_TARGET)) throw new AppError("invalid_target");
    target = Math.round(target * 100) / 100;
    multiplier = target;
  }
  const potential = roundPayout(stake.mul(multiplier));
  if (potential.gt(limits.maxPayout)) throw new AppError("max_payout", { max: limits.maxPayout });

  return prisma.$transaction(async (tx) => {
    const seed = await activeSeed(tx, userId);
    // Claim the nonce atomically so two concurrent rounds never share one.
    const claimed = await tx.casinoSeed.updateMany({
      where: { id: seed.id, nonce: seed.nonce, active: true },
      data: { nonce: { increment: 1 } },
    });
    if (claimed.count === 0) throw new AppError("try_again");
    const nonce = seed.nonce;

    const f = roundFloat(seed.serverSeed, seed.clientSeed, nonce);
    const outcome = game === "DICE" ? diceRoll(f) : limboResult(f);
    const won = game === "DICE" ? outcome < target : outcome >= target;
    const payout = won ? potential : new Decimal(0);

    const wallet = await getOrCreateWallet(userId, currency, tx);
    const round = await tx.casinoRound.create({
      data: {
        userId,
        walletId: wallet.id,
        game,
        currency,
        stake,
        target,
        outcome,
        multiplier,
        payout,
        won,
        seedId: seed.id,
        nonce,
      },
    });
    await debit(tx, wallet.id, stake, "BET", `casino:${round.id}`);
    const after = won ? await credit(tx, wallet.id, payout, "WIN", `casino:${round.id}`) : null;
    const balance = after?.balance ?? (await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).balance;

    return { id: round.id, outcome, won, payout: payout.toString(), multiplier, nonce, balance: balance.toString() };
  });
}
