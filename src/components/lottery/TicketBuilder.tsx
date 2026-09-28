"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { OrderForm } from "@/components/OrderForm";
import { LocalTime } from "@/components/LocalTime";
import { StateBadge } from "./StateBadge";
import { formatMoneyClient } from "@/lib/locale-tags";

type LineType = "BORLETTE" | "LOTO3" | "MARIAGE";
type Line = { key: number; type: LineType; numbers: string; stake: string };

const PLACEHOLDER: Record<LineType, string> = { BORLETTE: "07", LOTO3: "123", MARIAGE: "12-34" };
const two = () => String(Math.floor(Math.random() * 100)).padStart(2, "0");

function quickPick(type: LineType): string {
  if (type === "BORLETTE") return two();
  if (type === "LOTO3") return String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  let a = two(),
    b = two();
  while (a === b) b = two();
  return `${a}-${b}`;
}

export type DrawOption = {
  id: string;
  name: string;
  lottery: string | null;
  session: string | null;
  drawAt: string | null;
  closesAt: string;
};

const MAX_PER_STATE = 4;

export function TicketBuilder({
  draws,
  limits,
  seller = false,
}: {
  draws: DrawOption[];
  limits: { min: number; max: number };
  seller?: boolean;
}) {
  const t = useTranslations("lottery");
  const locale = useLocale();
  const present = new Set(draws.map((d) => d.lottery ?? "OTHER"));
  const groups = ["NY", "FL", "GA", "OTHER"].filter((g) => present.has(g));
  const [group, setGroup] = useState(groups[0] ?? "NY");
  const [drawId, setDrawId] = useState(draws[0]?.id ?? "");
  const inGroup = draws.filter((d) => (d.lottery ?? "OTHER") === group).slice(0, MAX_PER_STATE);
  const selected = draws.find((d) => d.id === drawId);
  const [type, setType] = useState<LineType>("BORLETTE");
  const [numbers, setNumbers] = useState("");
  const [stake, setStake] = useState(String(limits.min * 5));
  const [lines, setLines] = useState<Line[]>([]);

  if (draws.length === 0) return <p className="card p-8 text-center text-muted">{t("noDraws")}</p>;

  function add(nums = numbers) {
    if (!nums.trim()) return;
    setLines((l) => [...l, { key: Date.now() + Math.random(), type, numbers: nums.trim(), stake }]);
    setNumbers("");
  }

  const total = lines.reduce((acc, l) => acc + (Number(l.stake.replace(",", ".")) || 0), 0);

  return (
    <div className="card space-y-5 p-5">
      <div>
        <p className="label">{t("chooseDraw")}</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => {
                setGroup(g);
                const first = draws.find((d) => (d.lottery ?? "OTHER") === g);
                if (first) setDrawId(first.id);
              }}
              className={`flex items-center gap-2 rounded-2xl border p-2 text-left transition ${
                g === group ? "border-ink bg-surface shadow-card" : "border-line bg-surface-2 hover:border-brand"
              }`}
            >
              <StateBadge code={g === "OTHER" ? null : g} size="sm" />
              <span className="truncate text-sm font-semibold">
                {t.has(`lotteries.${g}`) ? t(`lotteries.${g}`) : g}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {inGroup.map((d) => (
            <button
              key={d.id}
              onClick={() => setDrawId(d.id)}
              className={`rounded-xl border p-3 text-left transition ${d.id === drawId ? "border-gold bg-gold/15" : "border-line hover:border-gold"}`}
            >
              <p className="font-semibold">
                {d.session ? t(`sessions.${d.session}`) : d.name}
                {d.drawAt && (
                  <span className="ml-2 text-sm font-normal text-muted">
                    <LocalTime value={d.drawAt} />
                  </span>
                )}
              </p>
              <p className="text-xs text-muted">
                {t("closes")} <LocalTime value={d.closesAt} />
              </p>
            </button>
          ))}
        </div>
        {selected?.lottery && <p className="mt-2 text-xs text-muted">{t("stateRule")}</p>}
      </div>

      <div>
        <p className="label">{t("gameType")}</p>
        <div className="flex flex-wrap gap-2">
          {(["BORLETTE", "LOTO3", "MARIAGE"] as const).map((ty) => (
            <button
              key={ty}
              onClick={() => {
                setType(ty);
                setNumbers("");
              }}
              className={`chip border px-3 py-1.5 ${type === ty ? "border-gold bg-gold text-brand-ink" : "border-line text-muted"}`}
            >
              {t(`types.${ty}`)}
            </button>
          ))}
        </div>
      </div>

      <form
        className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div>
          <label className="label" htmlFor="numbers">
            {t("numbers")}
          </label>
          <input
            id="numbers"
            className="input text-center font-display text-lg font-bold tracking-widest"
            placeholder={PLACEHOLDER[type]}
            value={numbers}
            onChange={(e) => setNumbers(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="lstake">
            {t("stake")} (R$)
          </label>
          <input
            id="lstake"
            inputMode="decimal"
            className="input text-right tabular-nums"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={() => add(quickPick(type))} title={t("quickPick")}>
            🎲
          </button>
          <button type="submit" className="btn-ghost">
            {t("add")}
          </button>
        </div>
      </form>

      <div>
        <p className="label">{t("ticket")}</p>
        {lines.length === 0 ? (
          <p className="text-sm text-muted">{t("ticketEmpty")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-24 text-xs text-muted">{t(`types.${l.type}`)}</span>
                <span className="flex-1 font-display text-base font-bold tracking-widest">{l.numbers}</span>
                <span className="tabular-nums">
                  {formatMoneyClient(Number(l.stake.replace(",", ".")) || 0, locale)}
                </span>
                <button
                  onClick={() => setLines((x) => x.filter((y) => y.key !== l.key))}
                  className="text-muted hover:text-danger"
                  aria-label="×"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lines.length > 0 && (
        <div className="space-y-3 border-t border-line pt-4">
          <p className="text-sm">
            {t("total")}: <span className="font-bold tabular-nums">{formatMoneyClient(total, locale)}</span>
          </p>
          <OrderForm
            payload={() => ({
              kind: "LOTTERY",
              drawId,
              lines: lines.map((l) => ({ type: l.type, numbers: l.numbers, stake: l.stake.replace(",", ".") })),
            })}
            onCreated={() => setLines([])}
            seller={seller}
          />
        </div>
      )}
    </div>
  );
}
