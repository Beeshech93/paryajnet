"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_NAMES: Record<string, string> = {
  es: "Español",
  ht: "Kreyòl Ayisyen",
  fr: "Français",
  en: "English",
  pt: "Português",
};

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <select
      aria-label="Language"
      className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-semibold uppercase"
      value={locale}
      onChange={(e) => router.replace(pathname, { locale: e.target.value })}
    >
      {routing.locales.map((l) => (
        <option key={l} value={l}>
          {l.toUpperCase()} · {LOCALE_NAMES[l] || l.toUpperCase()}
        </option>
      ))}
    </select>
  );
}

export function NavLinks({ role }: { role: string | null }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const links = [
    { href: "/sports", label: t("sports") },
    { href: "/live", label: t("live"), isLive: true },
    { href: "/casino", label: t("casino") },
    { href: "/lottery", label: t("lottery") },
    { href: "/s", label: t("myService") },
    ...(role === "ADMIN" ? [{ href: "/admin", label: t("admin") }] : []),
    ...(role === "AGENT" ? [{ href: "/agent", label: t("agent") }] : []),
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto text-sm font-semibold">
      {links.map((l) => {
        const active = pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 whitespace-nowrap transition ${
              l.isLive
                ? active
                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                  : "text-red-400 hover:bg-red-500/10"
                : active
                ? "bg-brand/15 text-brand-strong"
                : "text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {l.isLive && (
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-red-500" />
              </span>
            )}
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
