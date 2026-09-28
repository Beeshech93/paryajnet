import { AdSlot } from "@/components/ads/AdSlot";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { LocalTime } from "@/components/LocalTime";
import { StateBadge } from "@/components/lottery/StateBadge";
import { TicketBuilder } from "@/components/lottery/TicketBuilder";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureUpcomingDraws } from "@/lib/lottery";
import { LOTTERY_PAYOUTS, lots } from "@/lib/lottery-rules";
import { CURRENCY_LIMITS } from "@/lib/money";
import { getActiveCurrency } from "@/lib/wallet";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("lottery") };
}

export default async function LotteryPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const [user, locale, t] = await Promise.all([getCurrentUser(), getLocale(), getTranslations("lottery")]);
  const currency = await getActiveCurrency(user, locale);
  await ensureUpcomingDraws();
  const [open, settled] = await Promise.all([
    prisma.lotteryDraw.findMany({
      where: { status: "OPEN", closesAt: { gt: new Date() } },
      orderBy: { closesAt: "asc" },
    }),
    prisma.lotteryDraw.findMany({
      where: { status: "SETTLED" },
      orderBy: [{ drawAt: "desc" }, { closesAt: "desc" }],
      take: 9,
    }),
  ]);

  const [p1, p2, p3] = LOTTERY_PAYOUTS.BORLETTE;
  const payouts = [
    { name: t("types.BORLETTE"), rule: t("rules.BORLETTE"), pays: `${p1}× / ${p2}× / ${p3}×` },
    { name: t("types.LOTO3"), rule: t("rules.LOTO3"), pays: `${LOTTERY_PAYOUTS.LOTO3}×` },
    { name: t("types.MARIAGE"), rule: t("rules.MARIAGE"), pays: `${LOTTERY_PAYOUTS.MARIAGE}×` },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      <AdSlot placement="LOTTERY" className="mt-5" />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <TicketBuilder
          draws={open.map((d) => ({
            id: d.id,
            name: d.name,
            lottery: d.lottery,
            session: d.session,
            drawAt: d.drawAt?.toISOString() ?? null,
            closesAt: d.closesAt.toISOString(),
          }))}
          currency={currency}
          limits={{ min: CURRENCY_LIMITS[currency].minStake, max: CURRENCY_LIMITS[currency].maxStake }}
          signedIn={!!user}
        />

        <div className="space-y-6">
          <section className="card p-4">
            <h2 className="font-display text-lg font-bold">{t("payoutTable")}</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {payouts.map((p) => (
                <li key={p.name}>
                  <div className="flex justify-between font-semibold">
                    <span>{p.name}</span>
                    <span className="text-gold-strong tabular-nums">{p.pays}</span>
                  </div>
                  <p className="text-xs text-muted">{p.rule}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-4">
            <h2 className="font-display text-lg font-bold">{t("results")}</h2>
            {settled.length === 0 && <p className="mt-2 text-sm text-muted">{t("noResults")}</p>}
            <ul className="mt-3 space-y-3">
              {settled.map((d) => {
                const [l1, l2, l3] = lots({ first: d.first!, second: d.second!, third: d.third! });
                return (
                  <li key={d.id} className="flex items-center gap-3 text-sm">
                    <StateBadge code={d.lottery} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {d.lottery ? `${t(`lotteries.${d.lottery}`)} · ${t(`sessions.${d.session}`)}` : d.name}
                      </p>
                      <p className="text-xs text-muted">
                        <LocalTime value={d.drawAt ?? d.closesAt} dateOnly />
                        {d.pick3 && (
                          <span className="ml-1 font-mono">
                            · P3 {d.pick3} · P4 {d.pick4}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-1 font-display font-bold tabular-nums">
                      <span
                        className="rounded-full bg-gold px-2 py-1 text-brand-ink"
                        title={`${t("types.LOTO3")}: ${d.first}`}
                      >
                        {l1}
                      </span>
                      <span className="rounded-full bg-brand/20 px-2 py-1">{l2}</span>
                      <span className="rounded-full bg-danger/15 px-2 py-1">{l3}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
