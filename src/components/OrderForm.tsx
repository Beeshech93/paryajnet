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
 * With `seller` (a signed-in sales agent) it records a cash sale instead: the
 * WhatsApp number is optional and the agent goes to the printable ticket.
 */
export function OrderForm({
  payload,
  disabled,
  onCreated,
  seller = false,
}: {
  payload: () => Payload;
  disabled?: boolean;
  onCreated?: () => void;
  seller?: boolean;
}) {
  const t = useTranslations("orders");
  const ts = useTranslations("sale");
  const router = useRouter();
  const [saved] = useState(() => (seller ? { name: "", phone: "" } : remembered()));
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
        const { code } = res.data as { code: string };
        onCreated?.();
        if (seller) {
          setName("");
          setPhone("");
          setAdult(false);
          router.push(`/agent/s/${code}`);
          return;
        }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, phone }));
        } catch {}
        router.push(`/s/${code}`);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {seller && <p className="chip bg-gold/20 px-3 py-1 text-gold-strong">💵 {ts("cashSale")}</p>}
      <div>
        <label className="label" htmlFor="of-name">
          {seller ? ts("customerName") : t("name")}
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
          {seller && <span className="font-normal normal-case"> · {ts("optional")}</span>}
        </label>
        <div className="flex">
          <span className="flex items-center rounded-l-xl border border-r-0 border-line bg-surface-2 px-3 text-sm text-muted">
            🇧🇷 +55
          </span>
          <input
            id="of-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required={!seller}
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(11) 98765-4321"
            className="input rounded-l-none"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted">{seller ? ts("whatsappHint") : t("whatsappHint")}</p>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={adult}
          onChange={(e) => setAdult(e.target.checked)}
          required
          className="mt-0.5 accent-brand"
        />
        <span>{seller ? ts("adult") : t("adult")}</span>
      </label>
      <button
        type="submit"
        disabled={pending || disabled}
        className={`${seller ? "btn-gold" : "btn-accent"} w-full py-3 text-base`}
      >
        {pending ? t("creating") : seller ? ts("sell") : t("create")}
      </button>
      <FormMessage state={result} />
    </form>
  );
}
