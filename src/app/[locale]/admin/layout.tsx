import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const t = await getTranslations("admin");
  const links = [
    { href: "/admin", label: t("nav.overview") },
    { href: "/admin/orders", label: t("nav.orders") },
    { href: "/admin/whatsapp", label: t("nav.whatsapp") },
    { href: "/admin/events", label: t("nav.events") },
    { href: "/admin/sports-data", label: t("nav.sportsData") },
    { href: "/admin/lottery", label: t("nav.lottery") },
    { href: "/admin/banners", label: t("nav.banners") },
    { href: "/admin/settings", label: t("nav.settings") },
  ];
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-line pb-4">
        <span className="chip mr-2 bg-danger/15 text-danger">ADMIN</span>
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
