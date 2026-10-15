import type { Metadata } from "next";
import { ModulePreview } from "@/features/preview/ModulePreview";

export const metadata: Metadata = { title: "Giving" };

export default function Page() {
  return (
    <ModulePreview
      module="giving"
      title="Giving"
      phase={3}
      points={[
        "Record tithes, offerings and other giving in LRD or USD",
        "Post entries to an append-only ledger",
        "Reverse a posted entry with a reason",
        "Close the day once offline drafts are reviewed",
      ]}
    />
  );
}
