import type { Metadata } from "next";
import { ModulePreview } from "@/features/preview/ModulePreview";

export const metadata: Metadata = { title: "Attendance" };

export default function Page() {
  return (
    <ModulePreview
      module="attendance"
      title="Attendance"
      phase={2}
      points={[
        "See every service with members and guests counted",
        "Attendance trends over the last 12 Sundays",
        "Open Sunday check-in",
      ]}
    />
  );
}
