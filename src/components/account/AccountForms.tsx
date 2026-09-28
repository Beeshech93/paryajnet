"use client";

import { useTranslations } from "next-intl";
import { selfExcludeAction, setDepositLimitAction } from "@/app/actions/account";
import { ActionForm, SubmitButton } from "@/components/ActionForm";

export function DepositLimitForm() {
  const t = useTranslations("account");
  return (
    <ActionForm action={setDepositLimitAction} success={t("saved")} className="mt-3 flex gap-2">
      <input name="limit" inputMode="decimal" placeholder={t("limitPlaceholder")} className="input tabular-nums" />
      <SubmitButton className="btn-ghost">{t("save")}</SubmitButton>
    </ActionForm>
  );
}

export function SelfExclusionForm() {
  const t = useTranslations("account");
  return (
    <ActionForm action={selfExcludeAction} success={t("saved")} className="mt-3 space-y-2">
      <select name="days" className="input" defaultValue="7">
        {[1, 7, 30, 180, 365].map((d) => (
          <option key={d} value={d}>
            {t("days", { count: d })}
          </option>
        ))}
      </select>
      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" name="confirm" className="mt-0.5 accent-danger" />
        <span>{t("confirmExclusion")}</span>
      </label>
      <SubmitButton className="btn-danger w-full">{t("exclude")}</SubmitButton>
    </ActionForm>
  );
}
