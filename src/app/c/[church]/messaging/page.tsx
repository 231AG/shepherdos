import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagingScreen } from "@/features/messaging/MessagingScreen";
import { ScreenFallback } from "@/components/shell/ScreenFallback";

export const metadata: Metadata = { title: "Messaging" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <MessagingScreen />
    </Suspense>
  );
}
