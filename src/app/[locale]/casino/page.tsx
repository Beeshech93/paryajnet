import { AdSlot } from "@/components/ads/AdSlot";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { CasinoGames } from "@/components/casino/CasinoGames";
import { getCurrentUser } from "@/lib/auth";
import { getFairnessState } from "@/lib/casino";
import { prisma } from "@/lib/db";
import { CURRENCY_LIMITS } from "@/lib/money";
import { getActiveCurrency } from "@/lib/wallet";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("casino") };
}

export default async function CasinoPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const [user, locale, t] = await Promise.all([getCurrentUser(), getLocale(), getTranslations("casino")]);
  const currency = await getActiveCurrency(user, locale);
  const fairness = user ? await getFairnessState(user.id) : null;
  const history = user
    ? await prisma.casinoRound.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 })
    : [];

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      <AdSlot placement="CASINO" className="mt-5" />
      <CasinoGames
        key={fairness?.serverSeedHash ?? "guest"}
        currency={currency}
        limits={{ min: CURRENCY_LIMITS[currency].minStake, max: CURRENCY_LIMITS[currency].maxStake }}
        fairness={fairness}
        history={history.map((r) => ({
          id: r.id,
          game: r.game,
          currency: r.currency,
          stake: r.stake.toString(),
          outcome: r.outcome.toString(),
          target: r.target.toString(),
          payout: r.payout.toString(),
          won: r.won,
        }))}
      />
    </div>
  );
}
