"use client";

import { createContext, useContext } from "react";
import type { Church, RoleId } from "@/data/types";
import type { Persona, Scope } from "@/data/repo";

export interface ChurchContextValue {
  church: Church;
  role: RoleId;
  persona: Persona;
  scope: Scope;
}

export const ChurchContext = createContext<ChurchContextValue | null>(null);

export function useChurch(): ChurchContextValue {
  const v = useContext(ChurchContext);
  if (!v) throw new Error("useChurch must be used inside the church app shell");
  return v;
}
