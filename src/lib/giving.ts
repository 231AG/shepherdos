import type { GivingType } from "@/data/types";

export const GIVING_TYPE_LABEL: Record<GivingType, string> = {
  tithe: "Tithes",
  offering: "Offerings",
  thanksgiving: "Thanksgiving",
  building_fund: "Building fund",
  pledge_payment: "Pledge payments",
};

/** Singular label for a single ledger row ("Tithe", "Offering"). */
export const GIVING_TYPE_SINGULAR: Record<GivingType, string> = {
  tithe: "Tithe",
  offering: "Offering",
  thanksgiving: "Thanksgiving",
  building_fund: "Building fund",
  pledge_payment: "Pledge payment",
};

export const REVERSAL_REASONS = [
  "Wrong amount",
  "Wrong member",
  "Wrong currency",
  "Wrong giving type",
  "Duplicate entry",
] as const;
