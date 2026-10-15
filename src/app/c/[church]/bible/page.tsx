import type { Metadata } from "next";
import { ModulePreview } from "@/features/preview/ModulePreview";

export const metadata: Metadata = { title: "Bible" };

export default function Page() {
  return (
    <ModulePreview
      module="bible"
      title="Bible"
      phase={5}
      points={[
        "Read the King James Version by book and chapter",
        "Search for a word or phrase",
      ]}
    />
  );
}
