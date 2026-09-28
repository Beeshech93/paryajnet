import { getTranslations } from "next-intl/server";
import { reviewKycAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { LocalTime } from "@/components/LocalTime";
import { prisma } from "@/lib/db";

export default async function AdminKyc() {
  const [t, tk] = await Promise.all([getTranslations("admin"), getTranslations("kyc")]);
  const [pending, recent] = await Promise.all([
    prisma.kycSubmission.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { user: true, files: { select: { id: true, kind: true } } },
    }),
    prisma.kycSubmission.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { reviewedAt: "desc" },
      take: 20,
      include: { user: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("kyc.pending")}</h2>
        <div className="space-y-3">
          {pending.map((s) => (
            <article key={s.id} className="card p-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <p className="label">{t("users.user")}</p>
                  <p className="font-semibold">{s.user.name}</p>
                  <p className="text-xs text-muted">{s.user.email}</p>
                </div>
                <div>
                  <p className="label">{tk("fullName")}</p>
                  <p className="font-semibold">{s.fullName}</p>
                </div>
                <div>
                  <p className="label">{s.documentType}</p>
                  <p className="font-mono">{s.documentNumber}</p>
                  <p className="text-xs text-brand-strong">{t("kyc.checksumOk")}</p>
                </div>
                <div>
                  <p className="label">{t("kyc.birthDate")}</p>
                  <p>
                    <LocalTime value={s.user.birthDate} dateOnly />
                  </p>
                  <p className="text-xs text-muted">
                    <LocalTime value={s.createdAt} />
                  </p>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {s.files.map((f) => (
                  <a
                    key={f.id}
                    href={`/api/kyc/file/${f.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-xl border border-line"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/kyc/file/${f.id}`} alt={f.kind} className="h-48 w-full object-cover" />
                    <p className="bg-surface-2 px-3 py-1.5 text-xs text-muted">{tk(`files.${f.kind}`)}</p>
                  </a>
                ))}
              </div>
              <ActionForm
                action={reviewKycAction}
                className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3"
              >
                <input type="hidden" name="submissionId" value={s.id} />
                <div className="min-w-60 flex-1">
                  <label className="label" htmlFor={`note-${s.id}`}>
                    {t("kyc.note")}
                  </label>
                  <input id={`note-${s.id}`} name="note" className="input" placeholder={t("kyc.notePlaceholder")} />
                </div>
                <button name="decision" value="approve" className="btn-primary">
                  {t("payments.approve")}
                </button>
                <button name="decision" value="reject" className="btn-danger">
                  {t("payments.reject")}
                </button>
              </ActionForm>
            </article>
          ))}
          {pending.length === 0 && <p className="card p-5 text-sm text-muted">{t("empty")}</p>}
        </div>
      </section>
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("payments.recent")}</h2>
        <div className="card divide-y divide-line text-sm">
          {recent.map((s) => (
            <div key={s.id} className="flex flex-wrap gap-3 px-4 py-2">
              <span className="flex-1">{s.user.email}</span>
              <span className="font-mono text-xs">
                {s.documentType} {s.documentNumber}
              </span>
              <span className="text-xs">{tk(`status.${s.status}`)}</span>
            </div>
          ))}
          {recent.length === 0 && <p className="p-4 text-muted">{t("empty")}</p>}
        </div>
      </section>
    </div>
  );
}
