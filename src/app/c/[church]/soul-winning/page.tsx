import type { Metadata } from "next";
import { ModulePreview } from "@/features/preview/ModulePreview";

export const metadata: Metadata = { title: "Soul-winning" };

export default function Page() {
  return (
    <ModulePreview
      module="soul_winning"
      title="Soul-winning"
      phase={4}
      points={[
        "Pipeline from first contact to converted",
        "Dated follow-up notes with an assignee",
        "Convert a prospect to a member, keeping the history",
      ]}
    />
  );
}
