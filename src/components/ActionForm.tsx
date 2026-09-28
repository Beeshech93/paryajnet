"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useTransition, type ReactNode } from "react";
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

const PendingContext = createContext<boolean | null>(null);

/**
 * Form bound to a server action. Submits through onSubmit rather than
 * `<form action>` because React resets uncontrolled fields after every form
 * action — including failed ones — which would wipe what the player typed.
 * Here fields are cleared only on success.
 */
export function ActionForm({ action, children, className, success, resetOnSuccess = true }: Props) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        // Include the clicked button's name/value (e.g. decision=approve).
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const data = new FormData(e.currentTarget, submitter);
        startTransition(() => formAction(data));
      }}
    >
      <PendingContext.Provider value={isPending}>
        {children}
        <FormMessage state={state} success={success} />
      </PendingContext.Provider>
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
  const contextPending = useContext(PendingContext);
  const { pending: formPending } = useFormStatus();
  const pending = contextPending ?? formPending;
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? "…" : children}
    </button>
  );
}
