import type { Metadata } from "next";
import { Suspense } from "react";
import { EventsScreen } from "@/features/events/EventsScreen";
import { ScreenFallback } from "@/components/shell/ScreenFallback";

export const metadata: Metadata = { title: "Events" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <EventsScreen />
    </Suspense>
  );
}
