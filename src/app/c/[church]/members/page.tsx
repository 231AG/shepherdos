import type { Metadata } from "next";
import { Suspense } from "react";
import { MembersScreen } from "@/features/members/MembersScreen";
import { ScreenFallback } from "@/components/shell/ScreenFallback";

export const metadata: Metadata = { title: "Members" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <MembersScreen />
    </Suspense>
  );
}
