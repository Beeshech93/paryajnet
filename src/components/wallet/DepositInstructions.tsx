"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { attachReceiptAction } from "@/app/actions/wallet";
import { ActionForm, SubmitButton } from "@/components/ActionForm";

function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const t = useTranslations("wallet");
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2">
        <p className={`min-w-0 flex-1 text-sm break-all select-all ${mono ? "font-mono" : "font-semibold"}`}>{value}</p>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          className="shrink-0 rounded-lg bg-brand px-2.5 py-1 text-xs font-bold text-brand-ink"
        >
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
    </div>
  );
}

export function DepositInstructions({
  paymentId,
  method,
  amount,
  info,
  receiptSent,
  payerNote,
}: {
  paymentId: string;
  method: string;
  amount: string;
  info: Record<string, string>;
  receiptSent: boolean;
  payerNote: string | null;
}) {
  const t = useTranslations("wallet");
  const manual = !!info.reference && (info.pixKey || info.clabe);

  return (
    <div className="mt-3 space-y-4 rounded-2xl bg-surface-2 p-4">
      {manual ? (
        <ol className="grid gap-2 text-xs text-muted sm:grid-cols-3">
          {[t("step1", { amount }), t("step2"), t("step3")].map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-brand-ink">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-muted">{t(`instructions.${method}`)}</p>
      )}

      {method === "PIX" && info.pixCode && (
        <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start">
          {info.pixQr && (
            <div
              className="mx-auto w-44 rounded-xl bg-white p-2 sm:w-full [&_svg]:h-auto [&_svg]:w-full"
              // QR generated server-side by the qrcode library from our own PIX payload.
              dangerouslySetInnerHTML={{ __html: info.pixQr }}
            />
          )}
          <div className="min-w-0 space-y-3">
            <CopyField label={t("fields.pixCode")} value={info.pixCode} />
            <div className="grid gap-3 sm:grid-cols-2">
              <CopyField label={t("fields.pixKey")} value={info.pixKey} />
              <CopyField label={t("fields.reference")} value={info.reference} />
            </div>
            <p className="text-xs text-muted">
              {t("fields.beneficiary")}: <b className="text-ink">{info.beneficiary}</b>
              {info.bank && <> · {info.bank}</>}
            </p>
          </div>
        </div>
      )}

      {method === "SPEI" && info.clabe && (
        <div className="grid gap-3 sm:grid-cols-2">
          <CopyField label={t("fields.clabe")} value={info.clabe} />
          <CopyField label={t("fields.reference")} value={info.reference} />
          <p className="text-xs text-muted sm:col-span-2">
            {t("fields.beneficiary")}: <b className="text-ink">{info.beneficiary}</b>
            {info.bank && <> · {info.bank}</>}
          </p>
        </div>
      )}

      {!manual &&
        Object.entries(info)
          .filter(([k, v]) => !["expiresAt", "barcodeUrl", "pixQr"].includes(k) && v)
          .map(([k, v]) => <CopyField key={k} label={t.has(`fields.${k}`) ? t(`fields.${k}`) : k} value={v} />)}

      {manual &&
        (receiptSent ? (
          <p className="rounded-xl bg-brand/10 p-3 text-sm text-brand-strong">
            ✓ {t("receiptSent")}
            {payerNote && <span className="block text-xs text-muted">“{payerNote}”</span>}
          </p>
        ) : (
          <ActionForm
            action={attachReceiptAction}
            success={t("receiptThanks")}
            className="space-y-3 border-t border-line pt-4"
          >
            <input type="hidden" name="paymentId" value={paymentId} />
            <p className="text-sm font-semibold">{t("paidTitle")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor={`note-${paymentId}`}>
                  {t("payerNote")}
                </label>
                <input
                  id={`note-${paymentId}`}
                  name="note"
                  maxLength={300}
                  className="input"
                  placeholder={t("payerNotePlaceholder")}
                />
              </div>
              <div>
                <label className="label" htmlFor={`rc-${paymentId}`}>
                  {t("receipt")}
                </label>
                <input
                  id={`rc-${paymentId}`}
                  name="receipt"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-bg file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink"
                />
              </div>
            </div>
            <SubmitButton>{t("sendReceipt")}</SubmitButton>
          </ActionForm>
        ))}
    </div>
  );
}
