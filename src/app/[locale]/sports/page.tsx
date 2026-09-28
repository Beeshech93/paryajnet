import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { SportsBoard, type BoardEvent } from "@/components/sports/SportsBoard";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CURRENCY_LIMITS } from "@/lib/money";
import { getActiveCurrency } from "@/lib/wallet";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("sports") };
}

export default async function SportsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const [user, locale, t] = await Promise.all([getCurrentUser(), getLocale(), getTranslations("sports")]);
  const currency = await getActiveCurrency(user, locale);

  const events = await prisma.event.findMany({
    where: { status: "SCHEDULED", startsAt: { gt: new Date() } },
    orderBy: { startsAt: "asc" },
    include: { markets: { include: { selections: true } } },
  });

  const board: BoardEvent[] = events.map((e) => ({
    id: e.id,
    sport: e.sport,
    league: e.league,
    homeTeam: e.homeTeam,
    awayTeam: e.awayTeam,
    startsAt: e.startsAt.toISOString(),
    markets: e.markets.map((m) => ({
      id: m.id,
      type: m.type,
      status: m.status,
      selections: m.selections.map((s) => ({ id: s.id, code: s.code, odds: s.odds.toString() })),
    })),
  }));

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      <SportsBoard
        events={board}
        currency={currency}
        limits={{ min: CURRENCY_LIMITS[currency].minStake, max: CURRENCY_LIMITS[currency].maxStake }}
        signedIn={!!user}
      />
    </div>
  );
}
