import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocalTime } from "@/components/LocalTime";
import { StateBadge } from "@/components/lottery/StateBadge";
import { prisma } from "@/lib/db";
import { ensureUpcomingDraws } from "@/lib/lottery";
import { formatOdds } from "@/lib/money";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const [t, tl, locale] = await Promise.all([getTranslations("home"), getTranslations("lottery"), getLocale()]);
  await ensureUpcomingDraws();
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
    {
      href: "/sports",
      title: t("sportsTitle"),
      body: t("sportsBody"),
      accent: "text-brand-strong",
      bar: "bg-brand",
      tint: "bg-brand/15",
      icon: "⚽",
    },
    {
      href: "/lottery",
      title: t("lotteryTitle"),
      body: t("lotteryBody"),
      accent: "text-gold-strong",
      bar: "bg-gold",
      tint: "bg-gold/25",
      icon: "🎟️",
    },
    {
      href: "/casino",
      title: t("casinoTitle"),
      body: t("casinoBody"),
      accent: "text-danger",
      bar: "bg-casino",
      tint: "bg-casino/15",
      icon: "🎲",
    },
  ];

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-300 via-sky-400 to-blue-500 p-8 text-brand-ink shadow-pop sm:p-12">
        <div className="absolute -top-24 -right-24 size-64 rounded-full bg-gold sm:size-80" aria-hidden />
        <div className="absolute -right-6 -bottom-10 size-32 rounded-full border-[14px] border-danger" aria-hidden />
        <div
          className="absolute top-16 right-44 hidden size-16 rotate-12 rounded-2xl bg-white/50 lg:block"
          aria-hidden
        />
        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-bold tracking-wide uppercase">
            <span className="size-2 rounded-full bg-danger" /> {t("kicker")}
          </p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold tracking-tight sm:text-6xl">{t("title")}</h1>
          <p className="mt-4 max-w-xl text-base font-medium text-brand-ink/80">{t("subtitle")}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/sports" className="btn-accent px-6 py-3 text-base">
              {t("ctaSports")}
            </Link>
            <Link
              href="/register"
              className="btn bg-white px-6 py-3 text-base text-brand-ink shadow-sm hover:bg-sky-50"
            >
              {t("ctaRegister")}
            </Link>
          </div>
          <p className="mt-6 text-xs font-medium text-brand-ink/70">{t("payments")}</p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {verticals.map((v) => (
          <Link
            key={v.href}
            href={v.href}
            className="card group relative overflow-hidden p-6 transition hover:-translate-y-0.5 hover:shadow-pop"
          >
            <span className={`absolute inset-x-0 top-0 h-1.5 ${v.bar}`} aria-hidden />
            <div className={`flex size-12 items-center justify-center rounded-2xl text-2xl ${v.tint}`}>{v.icon}</div>
            <h2 className={`mt-3 font-display text-lg font-bold ${v.accent}`}>{v.title}</h2>
            <p className="mt-1 text-sm text-muted">{v.body}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-bold">{t("upcoming")}</h2>
            <Link href="/sports" className="text-sm text-brand-strong">
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
