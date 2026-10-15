import type { Metadata } from "next";
import { Suspense } from "react";
import { DepartmentsScreen } from "@/features/departments/DepartmentsScreen";
import { ScreenFallback } from "@/components/shell/ScreenFallback";

export const metadata: Metadata = { title: "Departments" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <DepartmentsScreen />
    </Suspense>
  );
}
