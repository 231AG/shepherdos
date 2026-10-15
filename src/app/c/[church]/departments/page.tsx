import type { Metadata } from "next";
import { ModulePreview } from "@/features/preview/ModulePreview";

export const metadata: Metadata = { title: "Departments" };

export default function Page() {
  return (
    <ModulePreview
      module="departments"
      title="Departments"
      phase={4}
      points={[
        "Department cards with members, leaders and recent attendance",
        "Assign members to one or more departments",
      ]}
    />
  );
}
