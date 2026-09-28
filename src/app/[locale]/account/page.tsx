import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { LocalTime } from "@/components/LocalTime";
import { DepositLimitForm, SelfExclusionForm } from "@/components/account/AccountForms";
import { KycForm } from "@/components/account/KycForm";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { getActiveCurrency, getOrCreateWallet } from "@/lib/wallet";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("account") };
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const user = await requireUser();
  const [locale, t] = await Promise.all([getLocale(), getTranslations("account")]);
  const currency = await getActiveCurrency(user, locale);
  const wallet = await getOrCreateWallet(user.id, currency);
  const excluded = user.selfExcludedUntil && user.selfExcludedUntil > new Date();
  const tk = await getTranslations("kyc");
  const lastKyc = await prisma.kycSubmission.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  const KYC_STYLE: Record<string, string> = {
    NONE: "bg-surface-2 text-muted",
    PENDING: "bg-gold/15 text-gold-strong",
    VERIFIED: "bg-brand/15 text-brand-strong",
    REJECTED: "bg-danger/15 text-danger",
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>

      <section className="card grid gap-4 p-5 text-sm sm:grid-cols-3">
        <div>
          <p className="label">{t("name")}</p>
          <p className="font-semibold">{user.name}</p>
        </div>
        <div>
          <p className="label">{t("email")}</p>
          <p className="font-semibold break-all">{user.email}</p>
        </div>
        <div>
          <p className="label">{t("memberSince")}</p>
          <p className="font-semibold">
            <LocalTime value={user.createdAt} dateOnly />
          </p>
        </div>
      </section>

      <section id="kyc" className="card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-lg font-bold">{tk("title")}</h2>
          <span className={`chip ${KYC_STYLE[user.kycStatus]}`}>{tk(`status.${user.kycStatus}`)}</span>
        </div>
        <p className="mt-1 text-sm text-muted">{tk(`body.${user.kycStatus}`)}</p>
        {user.kycStatus === "REJECTED" && lastKyc?.reviewNote && (
          <p className="mt-2 rounded-xl bg-danger/10 p-3 text-sm text-danger">
            {tk("reason")}: {lastKyc.reviewNote}
          </p>
        )}
        {(user.kycStatus === "NONE" || user.kycStatus === "REJECTED") && (
          <KycForm defaultType={currency === "MXN" ? "CURP" : "CPF"} defaultName={user.name} />
        )}
      </section>

      <section className="card p-5">
        <h2 className="font-display text-lg font-bold">{t("responsibleTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("responsibleBody")}</p>

        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-semibold">
              {t("depositLimit")} ({currency})
            </h3>
            <p className="text-xs text-muted">
              {wallet.dailyDepositLimit
                ? t("currentLimit", { limit: formatMoney(wallet.dailyDepositLimit, currency, locale) })
                : t("noLimit")}
            </p>
            <DepositLimitForm />
          </div>
          <div>
            <h3 className="font-semibold">{t("selfExclusion")}</h3>
            {excluded ? (
              <p className="mt-2 rounded-xl bg-danger/10 p-3 text-sm text-danger">
                {t("excludedUntil")} <LocalTime value={user.selfExcludedUntil!} />
              </p>
            ) : (
              <p className="text-xs text-muted">{t("selfExclusionBody")}</p>
            )}
            <SelfExclusionForm />
          </div>
        </div>
      </section>
    </div>
  );
}
