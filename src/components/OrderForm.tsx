"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createOrderAction } from "@/app/actions/orders";
import { FormMessage } from "@/components/ActionForm";
import type { ActionResult } from "@/lib/types";

type Payload =
  | { kind: "SPORTS"; stake: string; legs: { selectionId: string; odds: string }[] }
  | {
      kind: "LOTTERY";
      drawId: string;
      lines: { type: "BORLETTE" | "LOTO3" | "MARIAGE"; numbers: string; stake: string }[];
    };

const STORAGE_KEY = "pj_customer";

function remembered(): { name: string; phone: string } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "") as { name: string; phone: string };
  } catch {
    return { name: "", phone: "" };
  }
}

/**
 * Customer details for a new service (no account needed). On success the
 * customer goes to the service page; the WhatsApp agent sends the payment details.
 */
export function OrderForm({
  payload,
  disabled,
  onCreated,
}: {
  payload: () => Payload;
  disabled?: boolean;
  onCreated?: () => void;
}) {
  const t = useTranslations("orders");
  const router = useRouter();
  const [saved] = useState(remembered);
  const [name, setName] = useState(saved.name);
  const [phone, setPhone] = useState(saved.phone);
  const [adult, setAdult] = useState(false);
  const [result, setResult] = useState<ActionResult<unknown> | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await createOrderAction({ ...payload(), customerName: name, phone, adult: adult as true });
      setResult(res);
      if (res.ok) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, phone }));
        } catch {}
        onCreated?.();
        router.push(`/s/${(res.data as { code: string }).code}`);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label" htmlFor="of-name">
          {t("name")}
        </label>
        <input
          id="of-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          className="input"
        />
      </div>
      <div>
        <label className="label" htmlFor="of-phone">
          {t("whatsapp")}
        </label>
        <div className="flex">
          <span className="flex items-center rounded-l-xl border border-r-0 border-line bg-surface-2 px-3 text-sm text-muted">
            🇧🇷 +55
          </span>
          <input
            id="of-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(11) 98765-4321"
            className="input rounded-l-none"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted">{t("whatsappHint")}</p>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={adult}
          onChange={(e) => setAdult(e.target.checked)}
          required
          className="mt-0.5 accent-brand"
        />
        <span>{t("adult")}</span>
      </label>
      <button type="submit" disabled={pending || disabled} className="btn-accent w-full py-3 text-base">
        {pending ? t("creating") : t("create")}
      </button>
      <FormMessage state={result} />
    </form>
  );
}
