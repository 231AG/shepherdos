"use client";

import { useSyncExternalStore } from "react";
import { useDemoStore } from "@/data/store";

const noop = () => () => {};

/** False during prerender and hydration, true afterwards. Gates localStorage-backed UI. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** Tick a "Things to try" item for the current role. */
export function useGuideMark() {
  const role = useDemoStore((s) => s.role);
  const markGuide = useDemoStore((s) => s.markGuide);
  return (key: string, forRole = role) => {
    if (forRole) markGuide(`${forRole}:${key}`);
  };
}
