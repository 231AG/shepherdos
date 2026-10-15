import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { RoleId } from "./types";
import type { TableName, Tables } from "@/mock/seed";
import { STORE_KEY, STORE_VERSION } from "./constants";

/**
 * Visitor changes are stored as small per-table deltas on top of the seed.
 * The seed itself is regenerated on every load relative to today, so the
 * demo never looks stale and "Reset demo data" only has to clear deltas.
 */
export interface TableDelta<T> {
  added: T[];
  patched: Record<string, Partial<T>>;
  /** Ids removed by the visitor (only used to undo their own check-ins). */
  removed?: string[];
}

export type Deltas = { [K in TableName]?: TableDelta<Tables[K][number]> };

export interface DemoState {
  /** Session start; anchors time-of-day seed data such as support grant expiry. */
  epoch: number;
  role: RoleId | null;
  online: boolean;
  deltas: Deltas;
  guide: Record<string, true>;
  /** Ids currently animating from pending to synced. Not persisted. */
  syncing: string[];
  setSyncing: (ids: string[]) => void;
  setRole: (role: RoleId) => void;
  setOnline: (online: boolean) => void;
  markGuide: (key: string) => void;
  mutate: (fn: (deltas: Deltas) => Deltas) => void;
  resetDemo: () => void;
}

/** localStorage when available; in-memory otherwise (private browsing, SSR). */
const memory = new Map<string, string>();
const safeStorage: StateStorage = {
  getItem: (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  setItem: (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
  removeItem: (key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      memory.delete(key);
    }
  },
};

const initial = () => ({
  epoch: Date.now(),
  role: null as RoleId | null,
  online: true,
  deltas: {} as Deltas,
  guide: {} as Record<string, true>,
});

export const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      ...initial(),
      syncing: [],
      setSyncing: (ids) => set({ syncing: ids }),
      setRole: (role) => set({ role }),
      setOnline: (online) => set({ online }),
      markGuide: (key) => set((s) => (s.guide[key] ? s : { guide: { ...s.guide, [key]: true } })),
      mutate: (fn) => set((s) => ({ deltas: fn(s.deltas) })),
      resetDemo: () => set((s) => ({ ...initial(), role: s.role })),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      // A newer demo build discards older saved changes instead of guessing.
      migrate: () => initial() as unknown as DemoState,
      partialize: (s) => ({ epoch: s.epoch, role: s.role, online: s.online, deltas: s.deltas, guide: s.guide }),
    },
  ),
);
