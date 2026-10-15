import type { Metadata } from "next";
import { ModulePreview } from "@/features/preview/ModulePreview";

export const metadata: Metadata = { title: "Events" };

export default function Page() {
  return (
    <ModulePreview
      module="events"
      title="Events"
      phase={5}
      points={[
        "Month calendar and list of church events",
        "Link an event to a service",
        "Send a reminder through Messaging",
      ]}
    />
  );
}
