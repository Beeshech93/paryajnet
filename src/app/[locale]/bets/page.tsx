import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocalTime } from "@/components/LocalTime";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, formatOdds } from "@/lib/money";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("myBets") };
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-gold/15 text-gold",
  PENDING: "bg-gold/15 text-gold",
  WON: "bg-brand/15 text-brand",
  LOST: "bg-danger/15 text-danger",
  VOID: "bg-surface-2 text-muted",
};

const TABS = ["sports", "lottery", "casino"] as const;

export default async function BetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  setRequestLocale((await params).locale);
  const user = await requireUser();
  const [locale, t, ts, tl] = await Promise.all([
    getLocale(),
    getTranslations("bets"),
    getTranslations("sports"),
    getTranslations("lottery"),
  ]);
  const tabParam = (await searchParams).tab;
  const tab = TABS.find((x) => x === tabParam) ?? "sports";

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <div className="mt-4 flex gap-2">
        {TABS.map((x) => (
          <Link
            key={x}
            href={{ pathname: "/bets", query: { tab: x } }}
            className={`chip border px-4 py-2 text-sm ${x === tab ? "border-brand bg-brand text-brand-ink" : "border-line text-muted"}`}
          >
            {t(`tabs.${x}`)}
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {tab === "sports" &&
          (
            await prisma.bet.findMany({
              where: { userId: user.id },
              orderBy: { createdAt: "desc" },
              take: 50,
              include: { legs: { include: { selection: { include: { market: { include: { event: true } } } } } } },
            })
          ).map((b) => (
            <article key={b.id} className="card p-4 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`chip ${STATUS_STYLE[b.status]}`}>{t(`status.${b.status}`)}</span>
                <span className="font-semibold">
                  {b.legs.length === 1 ? ts("single") : ts("multiple", { count: b.legs.length })}
                </span>
                <span className="text-xs text-muted">
                  <LocalTime value={b.createdAt} />
                </span>
                <span className="ml-auto text-xs text-muted">#{b.id.slice(-8)}</span>
              </div>
              <ul className="mt-3 space-y-1.5">
                {b.legs.map((l) => {
                  const e = l.selection.market.event;
                  const type = l.selection.market.type;
                  const code = l.selection.code;
                  const pick =
                    type === "1X2"
                      ? code === "1"
                        ? e.homeTeam
                        : code === "2"
                          ? e.awayTeam
                          : ts("draw")
                      : `${ts(`markets.${type}`)} · ${ts(`codes.${code}`)}`;
                  return (
                    <li key={l.id} className="flex items-center gap-2">
                      <span
                        className={`size-2 shrink-0 rounded-full ${l.result === "WON" ? "bg-brand" : l.result === "LOST" ? "bg-danger" : l.result === "VOID" ? "bg-muted" : "bg-gold"}`}
                      />
                      <span className="flex-1">
                        <span className="font-semibold">{pick}</span>
                        <span className="text-muted">
                          {" "}
                          — {e.homeTeam} vs {e.awayTeam}
                          {e.homeScore != null ? ` (${e.homeScore}-${e.awayScore})` : ""}
                        </span>
                      </span>
                      <span className="font-bold tabular-nums">{formatOdds(l.odds, locale)}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-3 text-xs">
                <span>
                  {ts("stake")}: <b className="tabular-nums">{formatMoney(b.stake, b.currency, locale)}</b>
                </span>
                <span>
                  {ts("totalOdds")}: <b className="tabular-nums">{formatOdds(b.totalOdds, locale)}</b>
                </span>
                <span className="ml-auto">
                  {b.status === "OPEN" ? ts("potentialWin") : t("payout")}:{" "}
                  <b className="text-brand tabular-nums">
                    {formatMoney(b.payout ?? b.potentialWin, b.currency, locale)}
                  </b>
                </span>
              </div>
            </article>
          ))}

        {tab === "lottery" &&
          (
            await prisma.lotteryTicket.findMany({
              where: { userId: user.id },
              orderBy: { createdAt: "desc" },
              take: 50,
              include: { lines: true, draw: true },
            })
          ).map((tk) => (
            <article key={tk.id} className="card p-4 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`chip ${STATUS_STYLE[tk.status]}`}>{t(`status.${tk.status}`)}</span>
                <span className="font-semibold">{tk.draw.name}</span>
                <span className="text-xs text-muted">
                  <LocalTime value={tk.draw.closesAt} />
                </span>
                {tk.draw.first && (
                  <span className="ml-auto font-display font-bold tracking-wider text-gold">
                    {tk.draw.first} · {tk.draw.second} · {tk.draw.third}
                  </span>
                )}
              </div>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {tk.lines.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5">
                    <span className="w-20 text-xs text-muted">{tl(`types.${l.type}`)}</span>
                    <span className="flex-1 font-display font-bold tracking-widest">{l.numbers}</span>
                    <span className="text-xs tabular-nums">{formatMoney(l.stake, tk.currency, locale)}</span>
                    {l.payout && l.payout.gt(0) && (
                      <span className="text-xs font-bold text-brand tabular-nums">
                        +{formatMoney(l.payout, tk.currency, locale)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-6 border-t border-line pt-3 text-xs">
                <span>
                  {tl("total")}: <b className="tabular-nums">{formatMoney(tk.totalStake, tk.currency, locale)}</b>
                </span>
                {tk.payout && (
                  <span className="ml-auto">
                    {t("payout")}:{" "}
                    <b className="text-brand tabular-nums">{formatMoney(tk.payout, tk.currency, locale)}</b>
                  </span>
                )}
              </div>
            </article>
          ))}

        {tab === "casino" && (
          <div className="card divide-y divide-line text-sm">
            {(
              await prisma.casinoRound.findMany({
                where: { userId: user.id },
                orderBy: { createdAt: "desc" },
                take: 100,
              })
            ).map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="w-28 text-xs text-muted">
                  <LocalTime value={r.createdAt} />
                </span>
                <span className="w-14 font-semibold">{r.game}</span>
                <span className="flex-1 tabular-nums">
                  {formatOdds(r.outcome, locale)}
                  {r.game === "LIMBO" ? "×" : ""}
                  <span className="text-muted">
                    {" "}
                    / {r.game === "DICE" ? "<" : "≥"} {formatOdds(r.target, locale)} · nonce {r.nonce}
                  </span>
                </span>
                <span className={`font-bold tabular-nums ${r.won ? "text-brand" : "text-muted"}`}>
                  {r.won
                    ? `+${formatMoney(r.payout, r.currency, locale)}`
                    : `-${formatMoney(r.stake, r.currency, locale)}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
