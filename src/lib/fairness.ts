import { createHash, createHmac, randomBytes } from "node:crypto";

/** 1% house edge on every casino game. */
export const RTP = 0.99;
export const DICE_MIN_TARGET = 2;
export const DICE_MAX_TARGET = 98;
export const LIMBO_MIN_TARGET = 1.01;
export const LIMBO_MAX_TARGET = 1_000_000;

export function newServerSeed(): { serverSeed: string; serverSeedHash: string } {
  const serverSeed = randomBytes(32).toString("hex");
  return { serverSeed, serverSeedHash: sha256(serverSeed) };
}

export function newClientSeed(): string {
  return randomBytes(8).toString("hex");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Uniform float in [0, 1) derived from HMAC-SHA256(serverSeed, "clientSeed:nonce").
 * Players can recompute it once the server seed is revealed.
 */
export function roundFloat(serverSeed: string, clientSeed: string, nonce: number): number {
  const digest = createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}`).digest();
  return digest.readUInt32BE(0) / 2 ** 32;
}

/** Dice: roll in 0.00–99.99, win when roll < target. */
export function diceRoll(f: number): number {
  return Math.floor(f * 10_000) / 100;
}

export function diceMultiplier(target: number): number {
  return Math.floor((RTP * 100 * 10_000) / target) / 10_000;
}

/** Limbo: result multiplier ≥ 1.00; P(result ≥ t) = RTP / t. */
export function limboResult(f: number): number {
  const raw = RTP / (1 - f);
  return Math.min(LIMBO_MAX_TARGET, Math.max(1, Math.floor(raw * 100) / 100));
}
