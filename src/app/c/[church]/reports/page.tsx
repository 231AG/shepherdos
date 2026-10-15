import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportsScreen } from "@/features/reports/ReportsScreen";
import { ScreenFallback } from "@/components/shell/ScreenFallback";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <ReportsScreen />
    </Suspense>
  );
}
