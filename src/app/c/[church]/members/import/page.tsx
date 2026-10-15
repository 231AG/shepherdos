import type { Metadata } from "next";
import { ImportWizard } from "@/features/members/ImportWizard";

export const metadata: Metadata = { title: "Import members" };

export default function Page() {
  return <ImportWizard />;
}
