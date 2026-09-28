"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  sports: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7 3.8 2.8-1.5 4.5H9.7L8.2 9.8zM12 3v4M20.6 9.2l-4.8.6M17.5 19.3l-3.2-5M6.5 19.3l3.2-5M3.4 9.2l4.8.6" />
    </>
  ),
  lottery: (
    <>
      <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
      <path d="M14 5v12" strokeDasharray="2 2" />
    </>
  ),
  casino: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" />
      <circle cx="15" cy="15" r="1.2" fill="currentColor" />
      <circle cx="15" cy="9" r="1.2" fill="currentColor" />
      <circle cx="9" cy="15" r="1.2" fill="currentColor" />
    </>
  ),
  bets: <path d="M8 4h8M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zm3 5h6m-6 3h4" />,
  login: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4" />,
};

/** App-style tab bar for phones. */
export function BottomNav({ role }: { role: string | null }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = [
    { href: "/", key: "home", label: t("home") },
    { href: "/sports", key: "sports", label: t("sports") },
    { href: "/lottery", key: "lottery", label: t("lottery") },
    { href: "/s", key: "bets", label: t("myServiceShort") },
    ...(role === "ADMIN" ? [{ href: "/admin", key: "login", label: t("admin") }] : []),
    ...(role === "AGENT" ? [{ href: "/agent", key: "login", label: t("agentShort") }] : []),
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 print:hidden border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className={`mx-auto grid max-w-md ${items.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2 text-[11px] font-semibold transition ${
                  active ? "text-brand-strong" : "text-muted"
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition ${active ? "bg-brand/20" : ""}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    {ICONS[item.key]}
                  </svg>
                </span>
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
