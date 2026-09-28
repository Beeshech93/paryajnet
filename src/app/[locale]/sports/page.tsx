import { after } from "next/server";
import { AdSlot } from "@/components/ads/AdSlot";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SportsBoard, type BoardEvent } from "@/components/sports/SportsBoard";
import { prisma } from "@/lib/db";
import { autoSync } from "@/lib/sports-sync";
import { LIMITS } from "@/lib/money";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("sports") };
}

// Leaves room for the background odds/results sync scheduled with after().
export const maxDuration = 60;

export default async function SportsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  // Refresh real odds/results in the background when their interval has passed.
  after(autoSync);
  const t = await getTranslations("sports");

  const events = await prisma.event.findMany({
    where: { OR: [{ status: "LIVE" }, { status: "SCHEDULED", startsAt: { gt: new Date() } }] },
    orderBy: { startsAt: "asc" },
    include: {
      markets: {
        where: { status: { not: "SETTLED" } },
        orderBy: { sort: "asc" },
        include: { selections: { orderBy: { id: "asc" } } },
      },
    },
  });

  const board: BoardEvent[] = events.map((e) => ({
    id: e.id,
    sport: e.sport,
    league: e.league,
    homeTeam: e.homeTeam,
    awayTeam: e.awayTeam,
    startsAt: e.startsAt.toISOString(),
    status: e.status,
    clock: e.clock,
    homeScore: e.homeScore,
    awayScore: e.awayScore,
    markets: e.markets.map((m) => ({
      id: m.id,
      type: m.type,
      line: m.line === null ? null : Number(m.line),
      status: m.status,
      selections: m.selections.map((s) => ({ id: s.id, code: s.code, odds: s.odds.toString() })),
    })),
  }));

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      <AdSlot placement="SPORTS" className="mt-5" />
      <SportsBoard events={board} limits={{ min: LIMITS.minStake, max: LIMITS.maxStake }} />
    </div>
  );
}
