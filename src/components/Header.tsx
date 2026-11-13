import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { logoutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { LocaleSwitcher, NavLinks } from "./HeaderControls";

export async function Header() {
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations("nav")]);
  const role = user?.role ?? null;

  return (
    <header className="sticky top-0 z-30 print:hidden border-b border-amber-500/20 bg-slate-950/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 md:gap-4 md:py-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-display text-lg font-black tracking-tight md:text-xl"
        >
          <span className="relative flex size-8 items-center justify-center rounded-xl bg-linear-to-br from-amber-400 via-yellow-500 to-amber-600 shadow-md shadow-amber-500/20" aria-hidden>
            <span className="text-sm font-black text-slate-950">SP</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-white">SPORTSBOOK</span>
            <span className="rounded-md border border-amber-400/40 bg-amber-400/15 px-1.5 py-0.5 text-xs font-black tracking-wider text-amber-300">
              PRO
            </span>
          </span>
        </Link>
        <div className="hidden md:block">
          <NavLinks role={role} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher />
          <Link href="/casino" className="hidden rounded-xl border border-amber-400/40 bg-linear-to-r from-amber-500 to-yellow-400 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/10 hover:from-amber-400 hover:to-yellow-300 md:inline-flex">
            {t("casino")}
          </Link>
          {user && (
            <form action={logoutAction}>
              <button className="btn-ghost px-3 py-1.5 text-xs" title={user.email}>
                {t("logout")}
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
