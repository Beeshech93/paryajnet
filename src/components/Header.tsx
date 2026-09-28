import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { logoutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { LocaleSwitcher, NavLinks } from "./HeaderControls";

export async function Header() {
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations("nav")]);
  const role = user?.role ?? null;

  return (
    <header className="sticky top-0 z-30 print:hidden border-b border-line bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 md:gap-4 md:py-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-display text-lg font-bold tracking-tight md:text-xl"
        >
          <span className="relative flex size-8 items-center justify-center rounded-xl bg-brand shadow-pop" aria-hidden>
            <span className="absolute -top-1 -right-1 size-3 rounded-full bg-gold ring-2 ring-bg" />
            <span className="text-sm font-black text-brand-ink">P</span>
          </span>
          <span>
            Paryaj<span className="text-danger">Net</span>
          </span>
        </Link>
        <div className="hidden md:block">
          <NavLinks role={role} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher />
          <Link href="/s" className="btn-accent hidden px-3 py-1.5 whitespace-nowrap md:inline-flex">
            {t("myService")}
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
