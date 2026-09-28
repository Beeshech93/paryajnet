import { getTranslations } from "next-intl/server";
import { savePaymentSettingsAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { formatPixKey, PIX_KEY_TYPES } from "@/lib/pix";
import { getPaymentSettings } from "@/lib/settings";

export default async function AdminSettings() {
  const t = await getTranslations("admin.settings");
  const s = await getPaymentSettings();
  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} defaultValue={s[name as keyof typeof s] ?? ""} className="input" {...props} />
    </div>
  );

  return (
    <ActionForm
      action={savePaymentSettingsAction}
      success={t("saved")}
      resetOnSuccess={false}
      className="max-w-3xl space-y-6"
    >
      <p className="rounded-2xl bg-brand/15 p-4 text-sm">{t("intro")}</p>

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-lg font-bold">PIX</h2>
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <div>
            <label className="label" htmlFor="pix.keyType">
              {t("pixKeyType")}
            </label>
            <select id="pix.keyType" name="pix.keyType" defaultValue={s["pix.keyType"] ?? "CNPJ"} className="input">
              {PIX_KEY_TYPES.map((k) => (
                <option key={k} value={k}>
                  {t(`pixTypes.${k}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pix.key">
              {t("pixKey")}
            </label>
            <input
              id="pix.key"
              name="pix.key"
              defaultValue={s["pix.key"] ? formatPixKey(s["pix.keyType"] ?? "", s["pix.key"]) : ""}
              className="input font-mono"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {field("pix.name", t("beneficiary"), { maxLength: 25, placeholder: "PARYAJNET LTDA" })}
          {field("pix.city", t("city"), { maxLength: 15, placeholder: "SAO PAULO" })}
          {field("pix.bank", t("bank"), { maxLength: 60 })}
        </div>
        <p className="text-xs text-muted">{t("pixHint")}</p>
      </section>

      <SubmitButton>{t("save")}</SubmitButton>
    </ActionForm>
  );
}
