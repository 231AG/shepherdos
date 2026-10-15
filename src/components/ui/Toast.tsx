"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { create } from "zustand";
import { cn } from "@/lib/cn";

type Tone = "success" | "info" | "warning";
interface ToastItem {
  id: number;
  title: string;
  body?: string;
  tone: Tone;
}

const useToasts = create<{ items: ToastItem[]; push: (t: Omit<ToastItem, "id">) => void; dismiss: (id: number) => void }>((set) => ({
  items: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items.slice(-2), { ...t, id }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((x) => x.id !== id) })), 4200);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

export function toast(title: string, opts: { body?: string; tone?: Tone } = {}) {
  useToasts.getState().push({ title, body: opts.body, tone: opts.tone ?? "success" });
}

/** For features outside the demo's scope: say so instead of doing nothing. */
export function fullVersionToast(feature?: string) {
  toast("Available in the full version", {
    tone: "info",
    body: feature ? `${feature} is part of the full ShepherdOS build, not this demo.` : "This part is not included in the demo.",
  });
}

const icons = { success: CheckCircle2, info: Info, warning: TriangleAlert };

export function Toaster() {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
    >
      {items.map((t) => {
        const Icon = icons[t.tone];
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm animate-slide-in-up items-start gap-3 rounded-2xl bg-navy-950 px-4 py-3 text-white shadow-overlay"
          >
            <Icon className={cn("mt-0.5 size-5 shrink-0", t.tone === "warning" ? "text-gold" : t.tone === "info" ? "text-navy-200" : "text-gold")} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.body && <p className="mt-0.5 text-sm text-navy-200">{t.body}</p>}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="-mr-2 -mt-1 inline-flex size-9 items-center justify-center rounded-lg text-navy-200 hover:bg-navy-700 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
