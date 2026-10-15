import type { Metadata } from "next";
import { ModulePreview } from "@/features/preview/ModulePreview";

export const metadata: Metadata = { title: "Members" };

export default function Page() {
  return (
    <ModulePreview
      module="members"
      title="Members"
      phase={2}
      points={[
        "Search the directory by name or the last 4 digits of a phone number",
        "Filter by status (Active, New, Inactive, Excused) and department",
        "Open a member's profile, attendance history and departments",
        "Import a notebook spreadsheet with duplicate review",
      ]}
    />
  );
}
