import type { Metadata } from "next";
import { ModulePreview } from "@/features/preview/ModulePreview";

export const metadata: Metadata = { title: "Messaging" };

export default function Page() {
  return (
    <ModulePreview
      module="messaging"
      title="Messaging"
      phase={4}
      points={[
        "Send SMS to everyone, a department, a status group or chosen members",
        "Live character and segment counter with a credit estimate",
        "Opted-out members are excluded automatically",
      ]}
    />
  );
}
