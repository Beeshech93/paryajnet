import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { findValidReset, PASSWORD_MIN } from "@/lib/password-reset";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const [t, reset] = await Promise.all([getTranslations("auth"), findValidReset(token)]);
  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl font-bold">{t("resetTitle")}</h1>
      {reset ? (
        <>
          <p className="mt-2 text-sm text-muted">{t("resetFor", { email: reset.user.email })}</p>
          <ResetPasswordForm token={token} min={PASSWORD_MIN} />
        </>
      ) : (
        <div className="card mt-6 space-y-4 p-6">
          <p className="text-sm">{t("resetInvalid")}</p>
          <Link href="/forgot" className="btn-primary w-full">
            {t("sendLink")}
          </Link>
        </div>
      )}
    </div>
  );
}
