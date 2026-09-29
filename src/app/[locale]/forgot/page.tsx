"use client";

import { useTranslations } from "next-intl";
import { forgotPasswordAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Link } from "@/i18n/navigation";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl font-bold">{t("forgotTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{t("forgotBody")}</p>
      <ActionForm action={forgotPasswordAction} success={t("forgotSent")} className="card mt-6 space-y-4 p-6">
        <div>
          <label className="label" htmlFor="email">
            {t("email")}
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <SubmitButton className="btn-primary w-full">{t("sendLink")}</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-sm text-muted">{t("forgotAdminHint")}</p>
      <Link href="/login" className="mt-4 inline-block text-sm text-brand-strong">
        ← {t("backToLogin")}
      </Link>
    </div>
  );
}
