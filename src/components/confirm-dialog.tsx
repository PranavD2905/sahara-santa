"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button, Sparkle } from "./ui";

/** What a confirmation asks. A plain string is used as the title. */
export type ConfirmSpec =
  | string
  | {
      title: string;
      body?: ReactNode;
      confirmLabel?: string;
      /** "danger" for irreversible actions (delete, remove). */
      tone?: "default" | "danger";
    };

export function normalizeConfirm(spec: ConfirmSpec) {
  return typeof spec === "string" ? { title: spec } : spec;
}

/**
 * The app's replacement for window.confirm/prompt: a parchment modal in the
 * tarot Reveal style. Built on <dialog>.showModal(), so focus is trapped,
 * Esc cancels and the rest of the page is inert while it's open.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  /** null hides the Cancel button (info-only dialogs). */
  cancelLabel?: string | null;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-dialog-title"
      onCancel={(e) => {
        // Esc: let React state drive closing.
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        // Click on the backdrop (the <dialog> itself, outside the panel).
        if (e.target === ref.current) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] bg-transparent p-0 text-ink backdrop:bg-[#0b0f30]/70 backdrop:backdrop-blur-sm open:animate-[dialog-in_0.18s_ease-out]"
    >
      <div className="parchment p-6 text-left">
        <h2 id="confirm-dialog-title" className="flex items-start gap-2 font-title text-lg font-medium tracking-[0.12em] uppercase">
          <Sparkle className={`mt-1 h-4 w-3 shrink-0 ${tone === "danger" ? "text-berry" : "text-ink-soft"}`} />
          <span>{title}</span>
        </h2>
        {body && <div className="mt-3 text-sm text-ink/85">{body}</div>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {cancelLabel !== null && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          <Button type="button" variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
