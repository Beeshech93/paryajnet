"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createBannerAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { DateTimeInput } from "@/components/LocalTime";

const SWATCH: Record<string, string> = { blue: "bg-brand", yellow: "bg-gold", red: "bg-danger" };
const PREVIEW: Record<string, string> = {
  blue: "from-sky-300 via-sky-400 to-blue-500 text-brand-ink",
  yellow: "from-yellow-200 via-gold to-amber-400 text-brand-ink",
  red: "from-rose-500 via-danger to-red-700 text-white",
};

export function BannerForm() {
  const t = useTranslations("admin.banners");
  const [kind, setKind] = useState<"IMAGE" | "TEXT">("TEXT");
  const [theme, setTheme] = useState("blue");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState("");

  const file =
    "block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink";

  return (
    <ActionForm action={createBannerAction} success={t("created")} className="mt-4 space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="theme" value={theme} />
      <div className="flex gap-2">
        {(["TEXT", "IMAGE"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`chip border px-4 py-2 text-sm ${kind === k ? "border-brand bg-brand text-brand-ink" : "border-line text-muted"}`}
          >
            {t(`kinds.${k}`)}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="bn-title">
            {t("title")}
          </label>
          <input id="bn-title" name="title" required maxLength={100} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="bn-placement">
            {t("placement")}
          </label>
          <select id="bn-placement" name="placement" className="input">
            {["HOME", "SPORTS", "LOTTERY", "CASINO"].map((p) => (
              <option key={p} value={p}>
                {t(`placements.${p}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="bn-locale">
            {t("language")}
          </label>
          <select id="bn-locale" name="locale" className="input">
            <option value="all">{t("allLanguages")}</option>
            <option value="pt">Português</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="bn-sort">
            {t("order")}
          </label>
          <input id="bn-sort" name="sort" type="number" min={0} max={999} defaultValue={0} className="input" />
        </div>
      </div>

      {kind === "IMAGE" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="bn-image">
              {t("image")}
            </label>
            <input
              id="bn-image"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              required
              className={file}
            />
            <p className="mt-1 text-xs text-muted">{t("imageHint")}</p>
          </div>
          <div>
            <label className="label" htmlFor="bn-mobile">
              {t("mobileImage")}
            </label>
            <input
              id="bn-mobile"
              name="mobileImage"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className={file}
            />
            <p className="mt-1 text-xs text-muted">{t("mobileHint")}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-[2fr_3fr_1fr]">
            <div>
              <label className="label" htmlFor="bn-headline">
                {t("headline")}
              </label>
              <input
                id="bn-headline"
                name="headline"
                required
                maxLength={80}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="bn-body">
                {t("body")}
              </label>
              <input
                id="bn-body"
                name="body"
                maxLength={160}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="bn-cta">
                {t("cta")}
              </label>
              <input
                id="bn-cta"
                name="cta"
                maxLength={30}
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                className="input"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="label mb-0">{t("color")}</span>
            {Object.keys(SWATCH).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setTheme(c)}
                className={`size-8 rounded-full ${SWATCH[c]} ${theme === c ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`}
              />
            ))}
          </div>
          <div
            className={`flex min-h-24 flex-col justify-center gap-2 rounded-2xl bg-gradient-to-r p-5 sm:flex-row sm:items-center sm:justify-between ${PREVIEW[theme]}`}
          >
            <div>
              <p className="font-display text-xl font-bold">{headline || t("headline")}</p>
              {body && <p className="text-sm opacity-85">{body}</p>}
            </div>
            {cta && <span className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-bold text-brand-ink">{cta}</span>}
          </div>
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="bn-link">
            {t("link")}
          </label>
          <input id="bn-link" name="linkUrl" className="input" placeholder="https://… o /es/lottery" />
        </div>
        <div>
          <label className="label">{t("startsAt")}</label>
          <DateTimeInput name="startsAt" />
        </div>
        <div>
          <label className="label">{t("endsAt")}</label>
          <DateTimeInput name="endsAt" />
        </div>
      </div>
      <SubmitButton>{t("create")}</SubmitButton>
    </ActionForm>
  );
}
