"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { submitKycAction } from "@/app/actions/account";
import { FormMessage, SubmitButton } from "@/components/ActionForm";

const MAX_SIDE = 1600;

/** Downscale a photo to keep uploads small (phones produce 5–10 MB images). */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85));
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

export function KycForm({ defaultType, defaultName }: { defaultType: "CPF" | "CURP"; defaultName: string }) {
  const t = useTranslations("kyc");
  const [type, setType] = useState<string>(defaultType);
  const [state, formAction] = useActionState(
    async (prev: Awaited<ReturnType<typeof submitKycAction>> | null, form: FormData) => {
      for (const key of ["DOCUMENT_FRONT", "DOCUMENT_BACK", "SELFIE"]) {
        const f = form.get(key);
        if (f instanceof File && f.size > 0) form.set(key, await shrink(f));
      }
      return submitKycAction(prev, form);
    },
    null,
  );

  const fileInput = (name: string, label: string, required: boolean, capture?: "user" | "environment") => (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture={capture}
        required={required}
        className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink"
      />
    </div>
  );

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="fullName">
            {t("fullName")}
          </label>
          <input id="fullName" name="fullName" required defaultValue={defaultName} className="input" />
        </div>
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <div>
            <label className="label" htmlFor="documentType">
              {t("documentType")}
            </label>
            <select
              id="documentType"
              name="documentType"
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="CPF">CPF</option>
              <option value="CURP">CURP</option>
              <option value="PASSPORT">{t("passport")}</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="documentNumber">
              {t("documentNumber")}
            </label>
            <input
              id="documentNumber"
              name="documentNumber"
              required
              className="input font-mono uppercase"
              placeholder={type === "CPF" ? "000.000.000-00" : type === "CURP" ? "AAAA000000HAAAAA00" : "AB1234567"}
            />
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {fileInput("DOCUMENT_FRONT", t("front"), true, "environment")}
        {fileInput("DOCUMENT_BACK", t("back"), type !== "PASSPORT", "environment")}
        {fileInput("SELFIE", t("selfie"), true, "user")}
      </div>
      <p className="text-xs text-muted">{t("privacy")}</p>
      <SubmitButton>{t("submit")}</SubmitButton>
      <FormMessage state={state} success={t("submitted")} />
    </form>
  );
}
