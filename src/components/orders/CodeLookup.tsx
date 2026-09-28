"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function CodeLookup({ initial = "" }: { initial?: string }) {
  const t = useTranslations("orders");
  const router = useRouter();
  const [code, setCode] = useState(initial);
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (clean) router.push(`/s/${clean}`);
      }}
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="PJ7K3M9Q"
        aria-label={t("code")}
        className="input text-center font-mono text-lg font-bold tracking-widest uppercase"
        maxLength={12}
        autoCapitalize="characters"
      />
      <button className="btn-primary px-5">{t("lookup")}</button>
    </form>
  );
}
