"use client";

import { useTranslations } from "next-intl";
import { signupAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Link } from "@/i18n/navigation";

/** Request a back-office account (seller or admin); an admin approves it. */
export default function RegisterPage() {
  const t = useTranslations("auth");
  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl font-bold">{t("signupTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{t("signupBody")}</p>
      <ActionForm action={signupAction} success={t("signupSent")} className="card mt-6 space-y-4 p-6">
        <div>
          <label className="label" htmlFor="name">
            {t("name")}
          </label>
          <input id="name" name="name" required minLength={2} maxLength={80} autoComplete="name" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">
            {t("email")}
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">
            {t("password")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="input"
          />
          <p className="mt-1 text-[11px] text-muted">{t("passwordRule", { min: 8 })}</p>
        </div>
        <div>
          <label className="label" htmlFor="confirm">
            {t("confirmPassword")}
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="input"
          />
        </div>
        <SubmitButton className="btn-primary w-full">{t("signupCta")}</SubmitButton>
      </ActionForm>
      <Link href="/login" className="mt-4 inline-block text-sm text-brand-strong">
        ← {t("signupHaveAccount")}
      </Link>
    </div>
  );
}
