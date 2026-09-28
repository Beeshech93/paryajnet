"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_NAMES: Record<string, string> = { pt: "Português", es: "Español", fr: "Français", en: "English" };

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
          {l.toUpperCase()} · {LOCALE_NAMES[l]}
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
            className={`rounded-full px-4 py-2 whitespace-nowrap transition ${active ? "bg-brand/15 text-brand-strong" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
