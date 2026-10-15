import type { Metadata } from "next";
import { ModulePreview } from "@/features/preview/ModulePreview";

export const metadata: Metadata = { title: "Settings & roles" };

export default function Page() {
  return (
    <ModulePreview
      module="settings"
      title="Settings & roles"
      phase={5}
      points={[
        "Church profile and staff roles",
        "Status thresholds that recalculate New and Inactive live",
        "Pastor access to giving: none, totals only or full ledger",
        "Approve or deny support access requests",
      ]}
    />
  );
}
