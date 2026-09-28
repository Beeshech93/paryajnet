"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import type { ActionResult } from "@/lib/types";

type Props = {
  action: (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  success?: string;
  resetOnSuccess?: boolean;
};

export function ActionForm({ action, children, className, success, resetOnSuccess = true }: Props) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <FormMessage state={state} success={success} />
    </form>
  );
}

export function FormMessage({ state, success }: { state: ActionResult<unknown> | null; success?: string }) {
  const t = useTranslations("errors");
  if (!state) return null;
  if (state.ok) return success ? <p className="mt-2 text-sm text-brand-strong">{success}</p> : null;
  return (
    <p role="alert" className="mt-2 text-sm text-danger">
      {t.has(state.error) ? t(state.error, state.params) : t("unexpected")}
    </p>
  );
}

export function SubmitButton({ children, className = "btn-primary" }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? "…" : children}
    </button>
  );
}
