import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckInScreen } from "@/features/attendance/CheckInScreen";
import { ScreenFallback } from "@/components/shell/ScreenFallback";

export const metadata: Metadata = { title: "Sunday check-in" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <CheckInScreen />
    </Suspense>
  );
}
