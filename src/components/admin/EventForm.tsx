"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createEventAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { DateTimeInput } from "@/components/LocalTime";

const FOOTBALL = [
  ["o1", "1", "2.10"],
  ["oX", "X", "3.30"],
  ["o2", "2", "3.40"],
  ["oOver", "OVER", "1.90"],
  ["oUnder", "UNDER", "1.90"],
  ["oYes", "YES", "1.80"],
  ["oNo", "NO", "2.00"],
] as const;

export function EventForm() {
  const t = useTranslations("admin");
  const ts = useTranslations("sports");
  const [sport, setSport] = useState<"football" | "basketball">("football");
  return (
    <ActionForm action={createEventAction} success={t("done")} className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="label" htmlFor="ev-sport">
            {t("events.sport")}
          </label>
          <select
            id="ev-sport"
            name="sport"
            className="input"
            value={sport}
            onChange={(e) => setSport(e.target.value as never)}
          >
            <option value="football">{ts("sportNames.football")}</option>
            <option value="basketball">{ts("sportNames.basketball")}</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ev-league">
            {t("events.league")}
          </label>
          <input
            id="ev-league"
            name="league"
            required
            className="input"
            placeholder={sport === "football" ? "Brasileirão Série A" : "NBA"}
          />
        </div>
        <div>
          <label className="label" htmlFor="ev-home">
            {t("events.home")}
          </label>
          <input id="ev-home" name="homeTeam" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ev-away">
            {t("events.away")}
          </label>
          <input id="ev-away" name="awayTeam" required className="input" />
        </div>
        <div>
          <label className="label">{t("events.startsAt")}</label>
          <DateTimeInput name="startsAt" required />
        </div>
      </div>

      {sport === "football" ? (
        <>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
            {FOOTBALL.map(([name, code, def]) => (
              <div key={name}>
                <label className="label" htmlFor={`ev-${name}`}>
                  {code === "OVER" || code === "UNDER"
                    ? `${ts(`codes.${code}`)} 2.5`
                    : code === "YES" || code === "NO"
                      ? `${ts("markets.BTTS")} ${ts(`codes.${code}`)}`
                      : code}
                </label>
                <input
                  id={`ev-${name}`}
                  name={name}
                  type="number"
                  step="0.01"
                  min="1.01"
                  defaultValue={def}
                  required
                  className="input tabular-nums"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">{t("events.autoMarkets")}</p>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="ev-ml1">
              {t("events.home")} (ML)
            </label>
            <input
              id="ev-ml1"
              name="ml1"
              type="number"
              step="0.01"
              min="1.01"
              defaultValue="1.85"
              required
              className="input tabular-nums"
            />
          </div>
          <div>
            <label className="label" htmlFor="ev-ml2">
              {t("events.away")} (ML)
            </label>
            <input
              id="ev-ml2"
              name="ml2"
              type="number"
              step="0.01"
              min="1.01"
              defaultValue="1.95"
              required
              className="input tabular-nums"
            />
          </div>
          <div>
            <label className="label" htmlFor="ev-spread">
              {t("events.spread")}
            </label>
            <input
              id="ev-spread"
              name="spread"
              type="number"
              step="0.5"
              defaultValue="-2.5"
              required
              className="input tabular-nums"
            />
          </div>
          <div>
            <label className="label" htmlFor="ev-total">
              {t("events.total")}
            </label>
            <input
              id="ev-total"
              name="total"
              type="number"
              step="0.5"
              min="0.5"
              defaultValue="220.5"
              required
              className="input tabular-nums"
            />
          </div>
        </div>
      )}
      <SubmitButton>{t("events.createCta")}</SubmitButton>
    </ActionForm>
  );
}
