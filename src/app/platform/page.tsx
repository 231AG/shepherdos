import type { Metadata } from "next";
import { PlatformApp } from "@/features/platform/PlatformConsole";

export const metadata: Metadata = { title: "Platform console" };

export default function Page() {
  return <PlatformApp />;
}
