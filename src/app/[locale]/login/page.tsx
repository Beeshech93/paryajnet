"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  const t = useTranslations("auth");
  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl font-bold">{t("loginTitle")}</h1>
      <ActionForm action={loginAction} resetOnSuccess={false} className="card mt-6 space-y-4 p-6">
        <div>
          <label className="label" htmlFor="email">
            {t("email")}
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">
            {t("password")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
          />
        </div>
        <SubmitButton className="btn-primary w-full">{t("loginCta")}</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-muted">
        {t("noAccount")}{" "}
        <Link href="/register" className="text-brand-strong">
          {t("registerCta")}
        </Link>
      </p>
    </div>
  );
}
