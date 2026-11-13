import { after } from "next/server";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocalTime } from "@/components/LocalTime";
import { AdSlot } from "@/components/ads/AdSlot";
import { HeroBanner } from "@/components/home/HeroBanner";
import { StateBadge } from "@/components/lottery/StateBadge";
import { prisma } from "@/lib/db";
import { autoSync } from "@/lib/sports-sync";
import { ensureUpcomingDraws } from "@/lib/lottery";
import { formatOdds } from "@/lib/money";

// Leaves room for the background odds/results sync scheduled with after().
export const maxDuration = 60;

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  // Refresh real odds/results in the background when their interval has passed.
  after(autoSync);
  const [t, tl, locale] = await Promise.all([getTranslations("home"), getTranslations("lottery"), getLocale()]);
  await ensureUpcomingDraws();
  const heroMarkets = {
    where: { type: { in: ["1X2", "ML"] }, status: "OPEN" },
    include: { selections: { orderBy: { id: "asc" as const } } },
  };
  const [events, draw, liveEvent, lastResult] = await Promise.all([
    prisma.event.findMany({
      where: { status: "SCHEDULED", startsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 4,
      include: {
        markets: { where: { type: { in: ["1X2", "ML"] } }, include: { selections: { orderBy: { id: "asc" } } } },
      },
    }),
    prisma.lotteryDraw.findFirst({
      where: { status: "OPEN", closesAt: { gt: new Date() } },
      orderBy: { closesAt: "asc" },
    }),
    prisma.event.findFirst({
      where: { status: "LIVE" },
      orderBy: { startsAt: "asc" },
      include: { markets: heroMarkets },
    }),
    prisma.lotteryDraw.findFirst({ where: { status: "SETTLED" }, orderBy: [{ drawAt: "desc" }, { closesAt: "desc" }] }),
  ]);

  // Hero shows the live match if there is one (else the next game) and the latest official numbers (else the next draw).
  const featuredRow = liveEvent?.markets.length ? liveEvent : (events.find((e) => e.markets.length) ?? null);
  const featured = featuredRow ? { ...featuredRow, selections: featuredRow.markets[0]?.selections ?? [] } : null;
  const heroDraw = lastResult ?? draw;

  const verticals = [
    {
      href: "/sports",
      title: t("sportsTitle"),
      body: t("sportsBody"),
      accent: "text-amber-400",
      bar: "bg-linear-to-r from-amber-400 to-yellow-500",
      tint: "bg-amber-400/15 text-amber-300",
      icon: "⚽",
    },
    {
      href: "/casino",
      title: t("casinoTitle"),
      body: t("casinoBody"),
      accent: "text-emerald-400",
      bar: "bg-linear-to-r from-emerald-400 to-teal-500",
      tint: "bg-emerald-400/15 text-emerald-300",
      icon: "🎰",
    },
    {
      href: "/lottery",
      title: t("lotteryTitle"),
      body: t("lotteryBody"),
      accent: "text-yellow-400",
      bar: "bg-linear-to-r from-yellow-400 to-amber-500",
      tint: "bg-yellow-400/15 text-yellow-300",
      icon: "🎟️",
    },
  ];

  return (
    <div className="space-y-10">
      <HeroBanner event={featured} draw={heroDraw} />

      <AdSlot placement="HOME" />

      <section className="grid gap-4 sm:grid-cols-3">
        {verticals.map((v) => (
          <Link
            key={v.href}
            href={v.href}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 group relative overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:border-amber-400/40 hover:shadow-xl hover:shadow-amber-500/5"
          >
            <span className={`absolute inset-x-0 top-0 h-1.5 ${v.bar}`} aria-hidden />
            <div className={`flex size-12 items-center justify-center rounded-2xl text-2xl ${v.tint}`}>{v.icon}</div>
            <h2 className={`mt-3 font-display text-lg font-bold ${v.accent}`}>{v.title}</h2>
            <p className="mt-1 text-sm text-slate-400">{v.body}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-bold">{t("upcoming")}</h2>
            <Link href="/sports" className="text-sm text-brand-strong">
              {t("seeAll")}
            </Link>
          </div>
          <div className="space-y-2">
            {events.map((e) => (
              <Link
                key={e.id}
                href="/sports"
                className="card flex flex-col gap-3 p-4 hover:border-brand/50 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="w-full min-w-0 flex-1">
                  <p className="text-xs text-muted">
                    {e.league} · <LocalTime value={e.startsAt} />
                  </p>
                  <p className="truncate font-semibold">
                    {e.homeTeam} — {e.awayTeam}
                  </p>
                </div>
                <div className="grid grid-flow-col gap-1.5 text-sm font-bold tabular-nums sm:flex">
                  {e.markets[0]?.selections.map((s) => (
                    <span key={s.id} className="rounded-lg bg-surface-2 px-2.5 py-1.5">
                      <span className="mr-1 text-xs font-medium text-muted">{s.code}</span>
                      {formatOdds(s.odds, locale)}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
            {events.length === 0 && <p className="card p-6 text-sm text-muted">{t("noEvents")}</p>}
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-display text-xl font-bold">{t("nextDraw")}</h2>
          {draw ? (
            <Link href="/lottery" className="card block p-6 hover:border-gold">
              <div className="flex items-center gap-3">
                <StateBadge code={draw.lottery} />
                <p className="font-display text-2xl font-bold">
                  {draw.lottery ? tl(`lotteries.${draw.lottery}`) : draw.name}
                  {draw.session && (
                    <span className="block text-sm font-semibold text-gold-strong">
                      {tl(`sessions.${draw.session}`)}
                    </span>
                  )}
                </p>
              </div>
              <p className="mt-1 text-sm text-muted">
                {t("closes")} <LocalTime value={draw.closesAt} />
              </p>
              <p className="mt-4 text-sm">{t("drawPitch")}</p>
            </Link>
          ) : (
            <p className="card p-6 text-sm text-muted">{t("noDraw")}</p>
          )}
        </div>
      </section>
    </div>
  );
}
