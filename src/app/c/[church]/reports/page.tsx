import type { Metadata } from "next";
import { ModulePreview } from "@/features/preview/ModulePreview";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return (
    <ModulePreview
      module="reports"
      title="Reports"
      phase={5}
      points={[
        "Membership, attendance and giving reports by date range",
        "LRD and USD always reported separately",
        "Export to CSV or PDF",
      ]}
    />
  );
}
