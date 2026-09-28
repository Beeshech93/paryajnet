import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocalTime } from "@/components/LocalTime";
import { StateBadge } from "@/components/lottery/StateBadge";
import { lots } from "@/lib/lottery-rules";
import { formatOdds } from "@/lib/money";

type HeroEvent = {
  league: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  startsAt: Date;
  status: string;
  clock: string | null;
  homeScore: number | null;
  awayScore: number | null;
  selections: { id: string; code: string; odds: { toString(): string } }[];
};

type HeroDraw = {
  name: string;
  lottery: string | null;
  session: string | null;
  status: string;
  closesAt: Date;
  drawAt: Date | null;
  first: string | null;
  second: string | null;
  third: string | null;
};

const BALL = [
  "bg-[radial-gradient(circle_at_30%_30%,#fff7c2,#facc15_45%,#ca8a04)] text-brand-ink",
  "bg-[radial-gradient(circle_at_30%_30%,#e0f7ff,#38bdf8_45%,#0369a1)] text-brand-ink",
  "bg-[radial-gradient(circle_at_30%_30%,#ffd4d4,#ef4444_45%,#991b1b)] text-white",
];

/** Home hero: headline and calls to action, next to live product cards built from real data. */
export async function HeroBanner({ event, draw }: { event: HeroEvent | null; draw: HeroDraw | null }) {
  const [t, ts, tl, locale] = await Promise.all([
    getTranslations("home"),
    getTranslations("sports"),
    getTranslations("lottery"),
    getLocale(),
  ]);
  const live = event?.status === "LIVE";
  const settled = draw?.status === "SETTLED" && draw.first && draw.second && draw.third;
  const balls = settled ? lots({ first: draw.first!, second: draw.second!, third: draw.third! }) : ["?", "?", "?"];
  // Highlight the favourite, as a player would pick it on the slip.
  const favourite = event?.selections.reduce<string | null>(
    (best, s) =>
      best === null || Number(s.odds) < Number(event.selections.find((x) => x.id === best)!.odds) ? s.id : best,
    null,
  );

  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0a2f5c] via-[#0b5ea8] to-[#0ea5e9] p-6 text-white shadow-pop sm:p-10 lg:p-12">
      {/* Texture and glows (decorative) */}
      <div
        className="absolute inset-0 -z-10 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
          maskImage: "radial-gradient(ellipse at 75% 45%, black 25%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at 75% 45%, black 25%, transparent 70%)",
        }}
        aria-hidden
      />
      <div className="absolute -top-24 right-[-6rem] -z-10 size-96 rounded-full bg-sky-300/30 blur-3xl" aria-hidden />
      <div className="absolute right-24 -bottom-32 -z-10 size-80 rounded-full bg-danger/30 blur-3xl" aria-hidden />

      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Copy */}
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold tracking-wide uppercase backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-75 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-danger" />
            </span>
            {live ? t("heroLive") : t("kicker")}
          </p>
          <h1 className="mt-5 font-display text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl xl:text-6xl">
            {t.rich("title", {
              accent: (chunks) => (
                <span className="bg-gradient-to-r from-yellow-200 via-gold to-amber-300 bg-clip-text text-transparent">
                  {chunks}
                </span>
              ),
            })}
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/80 sm:text-lg">{t("subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/sports" className="btn-accent px-6 py-3 text-base shadow-lg shadow-danger/30">
              {t("ctaSports")}
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/register"
              className="btn border border-white/30 bg-white/10 px-6 py-3 text-base text-white backdrop-blur hover:bg-white/20"
            >
              {t("ctaRegister")}
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75">
            <li className="flex items-center gap-2">
              <Icon d="M3 7h18v10H3zM3 11h18M7 15h3" /> {t("trustPayments")}
            </li>
            <li className="flex items-center gap-2">
              <Icon d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4" /> {t("trustFair")}
            </li>
            <li className="flex items-center gap-2">
              <span className="rounded border border-white/40 px-1 text-[10px] leading-4 font-bold">18+</span>{" "}
              {t("trustAge")}
            </li>
          </ul>
        </div>

        {/* Product cards */}
        <div className="relative mx-auto h-[25rem] w-full max-w-md sm:h-[23rem] lg:h-[24rem]" aria-hidden>
          {event && (
            <div className="absolute top-0 left-0 w-[88%] -rotate-2 sm:w-80">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 shadow-2xl backdrop-blur-md motion-safe:animate-[float_6s_ease-in-out_infinite]">
                <div className="flex items-center justify-between text-[11px] font-semibold tracking-wide text-white/70 uppercase">
                  <span className="truncate">{event.league}</span>
                  {live ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-danger px-2 py-0.5 text-white">
                      {ts("live")} {event.clock && <span className="tabular-nums opacity-90">{event.clock}</span>}
                    </span>
                  ) : (
                    <span className="normal-case">
                      <LocalTime value={event.startsAt} />
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-1.5 font-semibold">
                  {[
                    [event.homeTeam, event.homeScore],
                    [event.awayTeam, event.awayScore],
                  ].map(([team, score]) => (
                    <div key={String(team)} className="flex items-center justify-between">
                      <span className="truncate">{team}</span>
                      {live && <span className="font-display text-xl tabular-nums">{score}</span>}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  {event.selections.map((s) => (
                    <span
                      key={s.id}
                      className={`flex flex-1 flex-col items-center rounded-xl py-1.5 text-sm ${
                        s.id === favourite ? "bg-brand text-brand-ink" : "bg-white/10 text-white"
                      }`}
                    >
                      <span className="text-[10px] opacity-70">{s.code}</span>
                      <span className="font-bold tabular-nums">{formatOdds(s.odds.toString(), locale)}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {draw && (
            <div className="absolute right-0 bottom-10 w-[80%] rotate-2 sm:w-72">
              <div className="rounded-2xl border border-white/20 bg-[#07111f]/70 p-4 shadow-2xl backdrop-blur-md motion-safe:animate-[float_7s_ease-in-out_1s_infinite]">
                <div className="flex items-center gap-2.5">
                  <StateBadge code={draw.lottery} size="sm" />
                  <div className="min-w-0 text-sm leading-tight">
                    <p className="truncate font-semibold">
                      {draw.lottery ? tl(`lotteries.${draw.lottery}`) : draw.name}
                      {draw.session && <span className="text-white/60"> · {tl(`sessions.${draw.session}`)}</span>}
                    </p>
                    <p className="text-[11px] text-white/60">
                      {settled ? t("heroLastNumbers") : t("closes")}{" "}
                      <LocalTime value={settled ? (draw.drawAt ?? draw.closesAt) : draw.closesAt} />
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-center gap-3">
                  {balls.map((n, i) => (
                    <span
                      key={i}
                      className={`flex size-14 items-center justify-center rounded-full font-display text-xl font-bold shadow-lg ring-1 ring-white/30 ${BALL[i]}`}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="absolute bottom-0 left-2 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur motion-safe:animate-[float_5s_ease-in-out_0.5s_infinite]">
            🎲 {t("heroCasinoChip")}
          </div>
        </div>
      </div>
    </section>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}
