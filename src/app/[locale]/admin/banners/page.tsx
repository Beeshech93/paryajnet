import { getTranslations } from "next-intl/server";
import { deleteBannerAction, toggleBannerAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { BannerForm } from "@/components/admin/BannerForm";
import { LocalTime } from "@/components/LocalTime";
import { prisma } from "@/lib/db";

export default async function AdminBanners() {
  const t = await getTranslations("admin.banners");
  const banners = await prisma.banner.findMany({
    orderBy: [{ placement: "asc" }, { sort: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      kind: true,
      placement: true,
      locale: true,
      linkUrl: true,
      headline: true,
      theme: true,
      active: true,
      startsAt: true,
      endsAt: true,
      views: true,
      clicks: true,
      imageMime: true,
      mobileMime: true,
      updatedAt: true,
    },
  });
  const now = new Date();

  return (
    <div className="space-y-8">
      <section className="card p-5">
        <h2 className="font-display text-lg font-bold">{t("new")}</h2>
        <BannerForm />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("list")}</h2>
        <div className="space-y-3">
          {banners.map((b) => {
            const live = b.active && (!b.startsAt || b.startsAt <= now) && (!b.endsAt || b.endsAt > now);
            const ctr = b.views ? ((b.clicks / b.views) * 100).toFixed(1) : "0.0";
            return (
              <article key={b.id} className="card grid gap-4 p-4 text-sm md:grid-cols-[220px_1fr_auto] md:items-center">
                {b.kind === "IMAGE" && b.imageMime ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/banners/${b.id}/image?v=${b.updatedAt.getTime()}`}
                    alt={b.title}
                    className="w-full rounded-xl object-cover"
                  />
                ) : (
                  <div
                    className={`rounded-xl p-3 font-display font-bold ${b.theme === "yellow" ? "bg-gold text-brand-ink" : b.theme === "red" ? "bg-danger text-white" : "bg-brand text-brand-ink"}`}
                  >
                    {b.headline}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{b.title}</p>
                    <span className={`chip ${live ? "bg-brand/15 text-brand-strong" : "bg-surface-2 text-muted"}`}>
                      {live ? t("live") : b.active ? t("scheduled") : t("paused")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {t(`placements.${b.placement}`)} · {b.locale === "all" ? t("allLanguages") : b.locale.toUpperCase()}{" "}
                    · {t(`kinds.${b.kind}`)}
                    {b.mobileMime && ` · ${t("hasMobile")}`}
                  </p>
                  {(b.startsAt || b.endsAt) && (
                    <p className="text-xs text-muted">
                      {b.startsAt && <LocalTime value={b.startsAt} />} →{" "}
                      {b.endsAt ? <LocalTime value={b.endsAt} /> : "∞"}
                    </p>
                  )}
                  {b.linkUrl && <p className="truncate font-mono text-xs text-muted">{b.linkUrl}</p>}
                  <p className="mt-1 text-xs tabular-nums">{t("stats", { views: b.views, clicks: b.clicks, ctr })}</p>
                </div>
                <div className="flex gap-2">
                  <ActionForm action={toggleBannerAction}>
                    <input type="hidden" name="bannerId" value={b.id} />
                    <SubmitButton className="btn-ghost py-1.5">{b.active ? t("pause") : t("activate")}</SubmitButton>
                  </ActionForm>
                  <ActionForm action={deleteBannerAction}>
                    <input type="hidden" name="bannerId" value={b.id} />
                    <SubmitButton className="btn-danger py-1.5">{t("delete")}</SubmitButton>
                  </ActionForm>
                </div>
              </article>
            );
          })}
          {banners.length === 0 && <p className="card p-5 text-sm text-muted">{t("empty")}</p>}
        </div>
      </section>
    </div>
  );
}
