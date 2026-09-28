import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocalTime } from "@/components/LocalTime";
import { prisma } from "@/lib/db";
import { formatOdds } from "@/lib/money";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const [t, locale] = await Promise.all([getTranslations("home"), getLocale()]);
  const [events, draw] = await Promise.all([
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
  ]);

  const verticals = [
    { href: "/sports", title: t("sportsTitle"), body: t("sportsBody"), accent: "text-brand", icon: "⚽" },
    { href: "/lottery", title: t("lotteryTitle"), body: t("lotteryBody"), accent: "text-gold", icon: "🎟️" },
    { href: "/casino", title: t("casinoTitle"), body: t("casinoBody"), accent: "text-casino", icon: "🎲" },
  ];

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-surface-2 via-surface to-bg p-8 sm:p-12">
        <div className="absolute -top-24 -right-24 size-72 rounded-full bg-brand/20 blur-3xl" aria-hidden />
        <p className="text-sm font-semibold text-brand">{t("kicker")}</p>
        <h1 className="mt-2 max-w-2xl font-display text-4xl font-bold tracking-tight sm:text-5xl">{t("title")}</h1>
        <p className="mt-4 max-w-xl text-muted">{t("subtitle")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/sports" className="btn-primary">
            {t("ctaSports")}
          </Link>
          <Link href="/register" className="btn-ghost">
            {t("ctaRegister")}
          </Link>
        </div>
        <p className="mt-6 text-xs text-muted">{t("payments")}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {verticals.map((v) => (
          <Link key={v.href} href={v.href} className="card group p-6 transition hover:border-brand/50">
            <div className="text-3xl">{v.icon}</div>
            <h2 className={`mt-3 font-display text-lg font-bold ${v.accent}`}>{v.title}</h2>
            <p className="mt-1 text-sm text-muted">{v.body}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-bold">{t("upcoming")}</h2>
            <Link href="/sports" className="text-sm text-brand">
              {t("seeAll")}
            </Link>
          </div>
          <div className="space-y-2">
            {events.map((e) => (
              <Link key={e.id} href="/sports" className="card flex items-center gap-4 p-4 hover:border-brand/50">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">
                    {e.league} · <LocalTime value={e.startsAt} />
                  </p>
                  <p className="truncate font-semibold">
                    {e.homeTeam} — {e.awayTeam}
                  </p>
                </div>
                <div className="flex gap-1.5 text-sm font-bold tabular-nums">
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
            <Link href="/lottery" className="card block p-6 hover:border-gold/50">
              <p className="font-display text-2xl font-bold text-gold">{draw.name}</p>
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
