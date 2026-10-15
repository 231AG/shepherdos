import type { Metadata } from "next";
import { Suspense } from "react";
import { BibleScreen } from "@/features/bible/BibleScreen";
import { ScreenFallback } from "@/components/shell/ScreenFallback";

export const metadata: Metadata = { title: "Bible" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <BibleScreen />
    </Suspense>
  );
}
