import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { logoutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/db";
import { getActiveCurrency } from "@/lib/wallet";
import { CurrencySwitcher, LocaleSwitcher, NavLinks } from "./HeaderControls";

export async function Header() {
  const [user, locale, t] = await Promise.all([getCurrentUser(), getLocale(), getTranslations("nav")]);
  const currency = await getActiveCurrency(user, locale);
  const wallet = user
    ? await prisma.wallet.findUnique({ where: { userId_currency: { userId: user.id, currency } } })
    : null;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="font-display text-xl font-bold tracking-tight">
          Paryaj<span className="text-brand">Net</span>
        </Link>
        <NavLinks isAdmin={user?.role === "ADMIN"} />
        <div className="ml-auto flex items-center gap-2">
          <CurrencySwitcher current={currency} />
          <LocaleSwitcher />
          {user ? (
            <>
              <Link href="/wallet" className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-bold tabular-nums">
                {formatMoney(wallet?.balance ?? 0, currency, locale)}
              </Link>
              <details className="relative">
                <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full bg-brand font-bold text-brand-ink">
                  {user.name.slice(0, 1).toUpperCase()}
                </summary>
                <div className="card absolute right-0 mt-2 w-48 p-1 text-sm shadow-xl">
                  <Link href="/wallet" className="block rounded-lg px-3 py-2 hover:bg-surface-2">
                    {t("wallet")}
                  </Link>
                  <Link href="/bets" className="block rounded-lg px-3 py-2 hover:bg-surface-2">
                    {t("myBets")}
                  </Link>
                  <Link href="/account" className="block rounded-lg px-3 py-2 hover:bg-surface-2">
                    {t("account")}
                  </Link>
                  <form action={logoutAction}>
                    <button className="w-full rounded-lg px-3 py-2 text-left text-danger hover:bg-surface-2">
                      {t("logout")}
                    </button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost py-1.5">
                {t("login")}
              </Link>
              <Link href="/register" className="btn-primary py-1.5">
                {t("register")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
