import { Link } from "@/i18n/navigation";

export default function CasinoHubPage() {
  const games = [
    {
      id: "roulette",
      title: "European Roulette",
      subtitle: "37 pockets (0-36) · Straight up 35:1",
      tag: "CLASSIC TABLE",
      rtp: "97.3% RTP",
      href: "/casino/roulette",
      icon: "🎡",
      gradient: "from-amber-500/20 via-slate-900 to-slate-950",
      accent: "text-amber-400 border-amber-500/30",
    },
    {
      id: "crash",
      title: "Crash Aviator",
      subtitle: "Watch the rocket fly · Cash out before the bust",
      tag: "FAST MULTIPLIER",
      rtp: "97.0% RTP",
      href: "/casino/crash",
      icon: "🚀",
      gradient: "from-emerald-500/20 via-slate-900 to-slate-950",
      accent: "text-emerald-400 border-emerald-500/30",
    },
    {
      id: "blackjack",
      title: "Blackjack Pro",
      subtitle: "Classic 52-card table · Natural 3:2 payout",
      tag: "CARD GAME",
      rtp: "99.5% RTP",
      href: "/casino/blackjack",
      icon: "🃏",
      gradient: "from-blue-500/20 via-slate-900 to-slate-950",
      accent: "text-blue-400 border-blue-500/30",
    },
    {
      id: "slots",
      title: "Golden 7s Jackpot",
      subtitle: "5 reels, 5 paylines · Wilds & 500x multipliers",
      tag: "SLOT MACHINE",
      rtp: "96.5% RTP",
      href: "/casino/slots",
      icon: "🎰",
      gradient: "from-yellow-500/20 via-slate-900 to-slate-950",
      accent: "text-yellow-400 border-yellow-500/30",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Hero Header */}
      <div className="relative mb-10 overflow-hidden rounded-3xl border border-amber-500/20 bg-linear-to-r from-slate-950 via-slate-900 to-slate-950 p-6 sm:p-10 shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-bold tracking-wider text-amber-300">
            <span className="size-2 animate-pulse rounded-full bg-amber-400" />
            SPORTSBOOK PRO CASINO · DEMO MODE
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Premium Casino <span className="bg-linear-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">Simulated Suite</span>
          </h1>
          <p className="mt-3 text-sm text-slate-300 sm:text-base">
            Enjoy certified provably fair casino games with virtual demo credits. Real-money gambling is strictly disabled. Practice strategies, test game mechanics, and experience the thrill in full safety.
          </p>
        </div>
      </div>

      {/* Game Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {games.map((g) => (
          <Link
            key={g.id}
            href={g.href}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-linear-to-b ${g.gradient} p-6 transition duration-300 hover:-translate-y-1 hover:border-amber-400/50 hover:shadow-2xl hover:shadow-amber-500/10`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-4xl group-hover:scale-110 transition duration-300">{g.icon}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${g.accent}`}>
                  {g.rtp}
                </span>
              </div>

              <div className="mt-6">
                <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  {g.tag}
                </span>
                <h3 className="mt-1 font-display text-xl font-bold text-white group-hover:text-amber-300 transition">
                  {g.title}
                </h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  {g.subtitle}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-800/80 pt-4">
              <span className="text-xs font-semibold text-amber-400 group-hover:underline">
                Play Demo
              </span>
              <span className="text-slate-400 transition group-hover:translate-x-1">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Compliance / Demo policy notice */}
      <div className="mt-12 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-center text-xs text-slate-400 sm:text-sm">
        <span className="font-bold text-slate-300">DEMO ONLY POLICY:</span> All games use simulated credits for entertainment and testing only. No real money can be deposited, won, or withdrawn. Strictly 18+.
      </div>
    </div>
  );
}

