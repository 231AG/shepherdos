import type { Metadata } from "next";
import { Suspense } from "react";
import { GivingScreen } from "@/features/giving/GivingScreen";
import { ScreenFallback } from "@/components/shell/ScreenFallback";

export const metadata: Metadata = { title: "Giving" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <GivingScreen />
    </Suspense>
  );
}
