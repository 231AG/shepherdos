"use client";

import { createContext, useContext } from "react";
import type { Church, RoleId } from "@/data/types";
import type { Persona, Scope } from "@/data/repo";
import type { ModuleId } from "@/lib/access";

export interface ChurchContextValue {
  church: Church;
  role: RoleId;
  persona: Persona;
  scope: Scope;
  /** Set when a platform operator is viewing this church under a support grant. */
  support: { grantId: string; expiresAt: string; approvedBy: string } | null;
  /** Can the current viewer open this module? (Role matrix plus support-session rules.) */
  can: (module: ModuleId) => boolean;
}

export const ChurchContext = createContext<ChurchContextValue | null>(null);

export function useChurch(): ChurchContextValue {
  const v = useContext(ChurchContext);
  if (!v) throw new Error("useChurch must be used inside the church app shell");
  return v;
}
