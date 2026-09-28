"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const t = useTranslations("orders");
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
