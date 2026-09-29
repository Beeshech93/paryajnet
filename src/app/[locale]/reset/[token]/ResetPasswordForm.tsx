"use client";

import { useTranslations } from "next-intl";
import { resetPasswordAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/ActionForm";

export function ResetPasswordForm({ token, min }: { token: string; min: number }) {
  const t = useTranslations("auth");
  return (
    <ActionForm action={resetPasswordAction} resetOnSuccess={false} className="card mt-6 space-y-4 p-6">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="password">
          {t("newPassword")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={min}
          required
          className="input"
        />
        <p className="mt-1 text-[11px] text-muted">{t("passwordRule", { min })}</p>
      </div>
      <div>
        <label className="label" htmlFor="confirm">
          {t("confirmPassword")}
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={min}
          required
          className="input"
        />
      </div>
      <SubmitButton className="btn-primary w-full">{t("savePassword")}</SubmitButton>
    </ActionForm>
  );
}
