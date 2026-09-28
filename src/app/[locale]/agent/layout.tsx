import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireSeller } from "@/lib/auth";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSeller();
  const t = await getTranslations("sale");
  const links = [
    { href: "/agent", label: t("nav.panel") },
    { href: "/sports", label: t("nav.sellSports") },
    { href: "/lottery", label: t("nav.sellLottery") },
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-line pb-4 print:hidden">
        <span className="chip mr-2 bg-gold/20 text-gold-strong">
          {t("badge")} · {user.name}
        </span>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink"
          >
            {l.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
