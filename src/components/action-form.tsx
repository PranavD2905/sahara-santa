"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import type { ActionState } from "@/app/groups/actions";
import { LIVE_MUTATION_EVENT } from "@/lib/live-updates";
import { ConfirmDialog, normalizeConfirm, type ConfirmSpec } from "./confirm-dialog";
import { Notice } from "./ui";

/**
 * Server actions bound with `.bind(null, ...ids)`. Zero-argument bound
 * actions fit too: the extra (state, form) arguments are simply ignored.
 */
type FormAction = (state: ActionState, form: FormData) => Promise<ActionState>;

/**
 * A form bound to a server action that shows its error/success message.
 * `confirm` asks first in the app's own modal (for Draw, removals, deletion).
 * The browser still validates required fields before the modal opens.
 */
export function ActionForm({
  action,
  children,
  confirm,
  className = "space-y-4",
}: {
  action: FormAction;
  children: ReactNode;
  confirm?: ConfirmSpec;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, form: FormData) => {
    const result = await action(previous, form);
    if (!result.error) {
      window.dispatchEvent(new CustomEvent(LIVE_MUTATION_EVENT, { detail: formRef.current }));
    }
    return result;
  }, {});
  const [asking, setAsking] = useState(false);
  const confirmed = useRef(false);
  const spec = confirm ? normalizeConfirm(confirm) : null;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3"
      onSubmit={(e) => {
        if (!spec || confirmed.current) {
          confirmed.current = false;
          return;
        }
        e.preventDefault();
        setAsking(true);
      }}
    >
      {/* `className` lays out the fields and buttons. It goes on the fieldset
          (their real parent): spacing utilities on the form wouldn't reach them. */}
      <fieldset disabled={pending} className={`m-0 min-w-0 border-0 p-0 ${className}`}>
        {children}
      </fieldset>
      <Notice tone="error">{state.error}</Notice>
      <Notice tone="success">{state.message}</Notice>
      {spec && (
        <ConfirmDialog
          open={asking}
          title={spec.title}
          body={spec.body}
          confirmLabel={spec.confirmLabel}
          tone={spec.tone}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            confirmed.current = true;
            formRef.current?.requestSubmit();
          }}
        />
      )}
    </form>
  );
}
