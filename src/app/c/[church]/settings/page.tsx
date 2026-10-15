import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsScreen } from "@/features/settings/SettingsScreen";
import { ScreenFallback } from "@/components/shell/ScreenFallback";

export const metadata: Metadata = { title: "Settings & roles" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <SettingsScreen />
    </Suspense>
  );
}
