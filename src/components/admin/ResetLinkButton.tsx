"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { resetLinkAction } from "@/app/actions/admin";
import { FormMessage } from "@/components/ActionForm";
import { CopyField } from "@/components/orders/CopyField";

/** Generates a one-time recovery link for a user, to send by WhatsApp or in person. */
export function ResetLinkButton({ userId }: { userId: string }) {
  const t = useTranslations("admin.agents");
  const [state, action, pending] = useActionState(resetLinkAction, null);
  return (
    <div className="w-full space-y-2">
      <form action={action}>
        <input type="hidden" name="id" value={userId} />
        <button className="btn-ghost py-1.5 text-xs" disabled={pending}>
          🔑 {pending ? "…" : t("resetLink")}
        </button>
      </form>
      {state?.ok && state.data && (
        <div className="space-y-1">
          <CopyField label={t("resetLinkLabel")} value={state.data} />
          <p className="text-[11px] text-muted">{t("resetLinkHelp")}</p>
        </div>
      )}
      <FormMessage state={state} />
    </div>
  );
}
