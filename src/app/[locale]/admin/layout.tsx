import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const t = await getTranslations("admin");
  const links = [
    { href: "/admin", label: t("nav.overview") },
    { href: "/admin/events", label: t("nav.events") },
    { href: "/admin/lottery", label: t("nav.lottery") },
    { href: "/admin/payments", label: t("nav.payments") },
    { href: "/admin/kyc", label: t("nav.kyc") },
    { href: "/admin/banners", label: t("nav.banners") },
    { href: "/admin/users", label: t("nav.users") },
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
