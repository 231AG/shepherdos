import type { Metadata } from "next";
import { ModulePreview } from "@/features/preview/ModulePreview";

export const metadata: Metadata = { title: "Sunday check-in" };

export default function Page() {
  return (
    <ModulePreview
      module="attendance"
      title="Sunday check-in"
      phase={2}
      points={[
        "Tap a member to check them in, even with no network",
        "Search by name or last 4 phone digits",
        "Count guests with a plus/minus counter",
        "See pending, synced and failed check-ins, then sync",
      ]}
    />
  );
}
