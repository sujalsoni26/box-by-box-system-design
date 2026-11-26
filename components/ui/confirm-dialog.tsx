"use client";
import { useRef, type ReactNode } from "react";
import { useBackdropDismiss } from "@/lib/hooks/use-backdrop-dismiss";
import { Button, type ButtonVariant } from "./button";

interface ConfirmDialogProps {
  trigger: string;
  triggerVariant?: ButtonVariant;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

/** Native <dialog> confirmation: focus is trapped; Escape or a click outside cancels. */
export function ConfirmDialog({
  trigger,
  triggerVariant = "danger",
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdrop = useBackdropDismiss(() => ref.current?.close());
  return (
    <>
      <Button variant={triggerVariant} onClick={() => ref.current?.showModal()}>
        {trigger}
      </Button>
      <dialog
        ref={ref}
        {...backdrop}
        aria-labelledby="confirm-title"
        data-companion-avoid=""
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line-strong bg-surface p-6 text-ink shadow-[var(--shadow-lift)] backdrop:bg-ink/35"
      >
        <h2 id="confirm-title" className="font-display text-xl font-bold">
          {title}
        </h2>
        <div className="mt-2 text-ink-2">{description}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" autoFocus onClick={() => ref.current?.close()}>
            {cancelLabel}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm();
              ref.current?.close();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </dialog>
    </>
  );
}
