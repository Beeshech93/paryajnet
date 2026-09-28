"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { registerAction } from "@/app/actions/auth";
import { DEFAULT_CURRENCY_BY_LOCALE } from "@/lib/currency-defaults";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-3xl font-bold">{t("registerTitle")}</h1>
      <p className="mt-1 text-sm text-muted">{t("registerSubtitle")}</p>
      <ActionForm action={registerAction} resetOnSuccess={false} className="card mt-6 space-y-4 p-6">
        <div>
          <label className="label" htmlFor="name">
            {t("name")}
          </label>
          <input id="name" name="name" autoComplete="name" required minLength={2} className="input" />
        </div>
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
            autoComplete="new-password"
            required
            minLength={8}
            className="input"
          />
          <p className="mt-1 text-xs text-muted">{t("passwordHint")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="birthDate">
              {t("birthDate")}
            </label>
            <input id="birthDate" name="birthDate" type="date" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="currency">
              {t("currency")}
            </label>
            <select id="currency" name="currency" defaultValue={DEFAULT_CURRENCY_BY_LOCALE[locale]} className="input">
              <option value="BRL">R$ · BRL</option>
              <option value="MXN">$ · MXN</option>
            </select>
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" name="terms" required className="mt-1 accent-brand" />
          <span>{t("terms")}</span>
        </label>
        <SubmitButton className="btn-primary w-full">{t("registerCta")}</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link href="/login" className="text-brand">
          {t("loginCta")}
        </Link>
      </p>
    </div>
  );
}
