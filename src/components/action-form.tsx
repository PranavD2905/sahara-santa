"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/app/groups/actions";
import { Notice } from "./ui";

/**
 * Server actions bound with `.bind(null, ...ids)`. Zero-argument bound
 * actions fit too: the extra (state, form) arguments are simply ignored.
 */
type FormAction = (state: ActionState, form: FormData) => Promise<ActionState>;

/**
 * A form bound to a server action that shows its error/success message.
 * `confirm` asks before submitting (for Draw, removals, deletion).
 */
export function ActionForm({
  action,
  children,
  confirm,
  className = "space-y-3",
}: {
  action: FormAction;
  children: ReactNode;
  confirm?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      <Notice tone="error">{state.error}</Notice>
      <Notice tone="success">{state.message}</Notice>
    </form>
  );
}
