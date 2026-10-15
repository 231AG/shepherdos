"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface BaseProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Native <dialog> gives focus trapping, Escape to close and a backdrop for
 * free. Modal is centred; Sheet slides in from the right (full screen on phones).
 */
function useNativeDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return ref;
}

function DialogShell({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  variant,
}: BaseProps & { variant: "modal" | "sheet" }) {
  const ref = useNativeDialog(open);
  const titleId = useId();
  const descId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        // Only lay out while open: a display class on a closed <dialog> would override display:none.
        "m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-ink backdrop:animate-fade-in open:fixed open:inset-0 open:flex",
        variant === "modal" && "items-end justify-center sm:items-center sm:p-6",
        variant === "sheet" && "justify-end",
      )}
    >
      {open && (
        <div
          className={cn(
            "flex max-h-full w-full flex-col bg-white shadow-overlay",
            variant === "modal" && "max-h-[92dvh] animate-slide-in-up rounded-t-2xl sm:max-w-lg sm:animate-pop-in sm:rounded-2xl",
            variant === "sheet" && "h-full animate-slide-in-right sm:max-w-xl sm:rounded-l-2xl",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-bold">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-0.5 text-sm text-muted">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-navy-50 hover:text-navy"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function Modal(props: BaseProps) {
  return <DialogShell {...props} variant="modal" />;
}

export function Sheet(props: BaseProps) {
  return <DialogShell {...props} variant="sheet" />;
}
