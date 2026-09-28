"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { playCasinoAction, rotateSeedAction } from "@/app/actions/play";
import { FormMessage } from "@/components/ActionForm";
import { formatMoneyClient, formatNumber } from "@/lib/locale-tags";
import type { ActionResult } from "@/lib/types";

// Mirrors src/lib/fairness.ts (which is server-only because it uses node:crypto).
const RTP = 0.99;
const diceMultiplier = (target: number) => Math.floor((RTP * 100 * 10_000) / target) / 10_000;

type Fairness = {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  previous: { serverSeed: string; serverSeedHash: string; clientSeed: string; nonce: number } | null;
} | null;

type Round = {
  id: string;
  game: string;
  currency: string;
  stake: string;
  outcome: string;
  target: string;
  payout: string;
  won: boolean;
};

export function CasinoGames({
  currency,
  limits,
  fairness,
  history: initialHistory,
}: {
  currency: string;
  limits: { min: number; max: number };
  fairness: Fairness;
  history: Round[];
}) {
  const t = useTranslations("casino");
  const locale = useLocale();
  const router = useRouter();
  const [game, setGame] = useState<"DICE" | "LIMBO">("DICE");
  const [stake, setStake] = useState(String(limits.min * 5));
  const [diceTarget, setDiceTarget] = useState(50);
  const [limboTarget, setLimboTarget] = useState("2.00");
  const [last, setLast] = useState<{ outcome: number; won: boolean; payout: string; game: string } | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [nonce, setNonce] = useState(fairness?.nonce ?? 0);
  const [error, setError] = useState<ActionResult<unknown> | null>(null);
  const [pending, start] = useTransition();

  const limboNum = Number(limboTarget.replace(",", "."));
  const multiplier = game === "DICE" ? diceMultiplier(diceTarget) : limboNum;
  const chance = game === "DICE" ? diceTarget : limboNum > 0 ? (RTP * 100) / limboNum : 0;
  const stakeNum = Number(stake.replace(",", ".")) || 0;

  function play() {
    const target = game === "DICE" ? diceTarget : limboNum;
    start(async () => {
      const res = await playCasinoAction({ game, stake: stake.replace(",", "."), target });
      if (!res.ok) return setError(res);
      setError(null);
      const d = res.data!;
      setLast({ outcome: d.outcome, won: d.won, payout: d.payout, game });
      setNonce(d.nonce + 1);
      setHistory((h) =>
        [
          {
            id: d.id,
            game,
            currency,
            stake,
            outcome: String(d.outcome),
            target: String(target),
            payout: d.payout,
            won: d.won,
          },
          ...h,
        ].slice(0, 10),
      );
      router.refresh(); // update the header balance
    });
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div className="flex gap-2">
          {(["DICE", "LIMBO"] as const).map((g) => (
            <button
              key={g}
              onClick={() => {
                setGame(g);
                setLast(null);
              }}
              className={`chip border px-4 py-2 text-sm ${game === g ? "border-casino bg-casino text-white" : "border-line text-muted"}`}
            >
              {t(`games.${g}`)}
            </button>
          ))}
        </div>

        <section className="card overflow-hidden">
          <div className="relative flex h-56 flex-col items-center justify-center bg-gradient-to-b from-casino/10 to-transparent">
            <p
              key={last ? `${last.outcome}-${nonce}` : "idle"}
              className={`font-display text-6xl font-bold tabular-nums transition ${last ? (last.won ? "text-brand-strong" : "text-danger") : "text-muted"}`}
            >
              {last
                ? game === "DICE"
                  ? formatNumber(last.outcome, locale)
                  : `${formatNumber(last.outcome, locale)}×`
                : game === "DICE"
                  ? "00.00"
                  : "1.00×"}
            </p>
            {last && (
              <p className="mt-2 text-sm font-semibold">
                {last.won ? t("won", { amount: formatMoneyClient(last.payout, currency, locale) }) : t("lost")}
              </p>
            )}
          </div>

          <div className="space-y-5 border-t border-line p-5">
            {game === "DICE" ? (
              <div>
                <div className="flex justify-between text-xs text-muted">
                  <span>{t("rollUnder")}</span>
                  <span className="font-bold text-ink tabular-nums">{diceTarget}</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={98}
                  value={diceTarget}
                  onChange={(e) => setDiceTarget(Number(e.target.value))}
                  className="mt-2 w-full accent-casino"
                />
              </div>
            ) : (
              <div>
                <label className="label" htmlFor="limbo">
                  {t("targetMultiplier")}
                </label>
                <input
                  id="limbo"
                  inputMode="decimal"
                  className="input tabular-nums"
                  value={limboTarget}
                  onChange={(e) => setLimboTarget(e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat
                label={t("multiplier")}
                value={`${formatNumber(multiplier, locale, 4).replace(/0+$/, "").replace(/[.,]$/, "")}×`}
              />
              <Stat label={t("winChance")} value={`${formatNumber(chance, locale)}%`} />
              <Stat
                label={t("payout")}
                value={formatMoneyClient(Math.floor(stakeNum * multiplier * 100) / 100, currency, locale)}
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="label" htmlFor="cstake">
                  {t("stake")} ({currency})
                </label>
                <input
                  id="cstake"
                  inputMode="decimal"
                  className="input tabular-nums"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                />
              </div>
              <button
                className="btn-ghost self-end"
                onClick={() => setStake(String(Math.max(limits.min, stakeNum / 2)))}
              >
                ½
              </button>
              <button
                className="btn-ghost self-end"
                onClick={() => setStake(String(Math.min(limits.max, stakeNum * 2)))}
              >
                2×
              </button>
            </div>

            {fairness ? (
              <button onClick={play} disabled={pending} className="btn-accent w-full py-3 text-base">
                {pending ? "…" : t("play")}
              </button>
            ) : (
              <Link href="/login" className="btn-primary w-full">
                {t("loginToPlay")}
              </Link>
            )}
            <FormMessage state={error} />
          </div>
        </section>

        {history.length > 0 && (
          <section>
            <h2 className="mb-2 font-display text-lg font-bold">{t("history")}</h2>
            <div className="card divide-y divide-line text-sm">
              {history.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-16 text-xs text-muted">{t(`games.${r.game}`)}</span>
                  <span className="flex-1 tabular-nums">
                    {formatNumber(r.outcome, locale)}
                    {r.game === "LIMBO" ? "×" : ""}
                    <span className="text-muted">
                      {" "}
                      / {r.game === "DICE" ? "<" : "≥"} {formatNumber(r.target, locale)}
                    </span>
                  </span>
                  <span className={`font-bold tabular-nums ${r.won ? "text-brand-strong" : "text-muted"}`}>
                    {r.won
                      ? `+${formatMoneyClient(r.payout, r.currency, locale)}`
                      : `-${formatMoneyClient(r.stake, r.currency, locale)}`}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <FairnessPanel fairness={fairness} nonce={nonce} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="text-[11px] text-muted uppercase">{label}</p>
      <p className="mt-0.5 font-bold tabular-nums">{value}</p>
    </div>
  );
}

function FairnessPanel({ fairness, nonce }: { fairness: Fairness; nonce: number }) {
  const t = useTranslations("casino");
  const [clientSeed, setClientSeed] = useState(fairness?.clientSeed ?? "");
  const [result, setResult] = useState<ActionResult<unknown> | null>(null);
  const [pending, start] = useTransition();

  return (
    <aside className="card h-fit space-y-4 p-4 text-sm">
      <div>
        <h2 className="font-display text-lg font-bold">{t("fairTitle")}</h2>
        <p className="text-xs text-muted">{t("fairBody")}</p>
      </div>
      {fairness ? (
        <>
          <Field label={t("serverSeedHash")} value={fairness.serverSeedHash} />
          <div>
            <label className="label" htmlFor="clientSeed">
              {t("clientSeed")}
            </label>
            <input
              id="clientSeed"
              className="input font-mono text-xs"
              value={clientSeed}
              onChange={(e) => setClientSeed(e.target.value)}
            />
          </div>
          <Field label={t("nonce")} value={String(nonce)} />
          <button
            className="btn-ghost w-full"
            disabled={pending}
            onClick={() => start(async () => setResult(await rotateSeedAction(clientSeed)))}
          >
            {t("rotate")}
          </button>
          <FormMessage state={result} success={t("rotated")} />
          {fairness.previous && (
            <div className="space-y-2 border-t border-line pt-3">
              <p className="text-xs font-semibold">{t("previousSeed")}</p>
              <Field label={t("serverSeed")} value={fairness.previous.serverSeed} />
              <Field label={t("clientSeed")} value={fairness.previous.clientSeed} />
              <Field label={t("roundsPlayed")} value={String(fairness.previous.nonce)} />
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-muted">{t("verifyHow")}</p>
        </>
      ) : (
        <p className="text-muted">{t("loginForFairness")}</p>
      )}
    </aside>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="font-mono text-xs break-all text-ink">{value}</p>
    </div>
  );
}
