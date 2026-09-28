"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { depositAction, simulatePaymentAction, withdrawAction } from "@/app/actions/wallet";
import { ActionForm, FormMessage, SubmitButton } from "@/components/ActionForm";
import type { ActionResult } from "@/lib/types";

export function DepositForm({ methods, currency }: { methods: string[]; currency: string }) {
  const t = useTranslations("wallet");
  return (
    <ActionForm action={depositAction} success={t("depositCreated")} className="mt-4 space-y-3">
      <MethodPicker methods={methods} />
      <div>
        <label className="label" htmlFor="damount">
          {t("amount")} ({currency})
        </label>
        <input id="damount" name="amount" inputMode="decimal" required className="input tabular-nums" />
      </div>
      <SubmitButton className="btn-primary w-full">{t("depositCta")}</SubmitButton>
    </ActionForm>
  );
}

const PIX_TYPES = ["CPF", "PHONE", "EMAIL", "EVP", "CNPJ"] as const;

export function WithdrawForm({ methods, currency }: { methods: string[]; currency: string }) {
  const t = useTranslations("wallet");
  const [method, setMethod] = useState(methods[0]);
  const [pixType, setPixType] = useState<string>("CPF");
  return (
    <ActionForm action={withdrawAction} success={t("withdrawCreated")} className="mt-4 space-y-3">
      <MethodPicker methods={methods} onChange={setMethod} />
      <div>
        <label className="label" htmlFor="wamount">
          {t("amount")} ({currency})
        </label>
        <input id="wamount" name="amount" inputMode="decimal" required className="input tabular-nums" />
      </div>
      {method === "PIX" ? (
        <div className="grid grid-cols-[130px_1fr] gap-2">
          <div>
            <label className="label" htmlFor="pixKeyType">
              {t("pixKeyType")}
            </label>
            <select
              id="pixKeyType"
              name="pixKeyType"
              value={pixType}
              onChange={(e) => setPixType(e.target.value)}
              className="input"
            >
              {PIX_TYPES.map((k) => (
                <option key={k} value={k}>
                  {t(`pixTypes.${k}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="destination">
              {t("fields.pixKey")}
            </label>
            <input
              id="destination"
              name="destination"
              required
              className="input font-mono"
              inputMode={
                pixType === "CPF" || pixType === "CNPJ" || pixType === "PHONE"
                  ? "numeric"
                  : pixType === "EMAIL"
                    ? "email"
                    : "text"
              }
              placeholder={t(`pixPlaceholders.${pixType}`)}
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="destination">
            {t("fields.clabe")}
          </label>
          <input
            id="destination"
            name="destination"
            required
            className="input font-mono"
            inputMode="numeric"
            maxLength={18}
          />
        </div>
      )}
      <p className="text-xs text-muted">{t("withdrawNote")}</p>
      <SubmitButton className="btn-ghost w-full">{t("withdrawCta")}</SubmitButton>
    </ActionForm>
  );
}

function MethodPicker({ methods, onChange }: { methods: string[]; onChange?: (m: string) => void }) {
  return (
    <div className="flex gap-2">
      {methods.map((m, i) => (
        <label key={m} className="flex-1 cursor-pointer">
          <input
            type="radio"
            name="method"
            value={m}
            defaultChecked={i === 0}
            className="peer sr-only"
            onChange={() => onChange?.(m)}
          />
          <span className="block rounded-xl border border-line py-2 text-center text-sm font-bold peer-checked:border-brand peer-checked:bg-brand/10">
            {m}
          </span>
        </label>
      ))}
    </div>
  );
}

export function SimulateButton({ paymentId }: { paymentId: string }) {
  const t = useTranslations("wallet");
  const [result, setResult] = useState<ActionResult<unknown> | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <button
        className="btn-ghost py-1.5 text-xs"
        disabled={pending}
        onClick={() => start(async () => setResult(await simulatePaymentAction(paymentId)))}
      >
        {t("simulate")}
      </button>
      <FormMessage state={result} />
    </div>
  );
}
