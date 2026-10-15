import { DEMO_CHURCH_SLUGS } from "@/data/constants";
import { AppShell } from "@/components/shell/AppShell";

export const dynamicParams = false;

export function generateStaticParams() {
  return DEMO_CHURCH_SLUGS.map((church) => ({ church }));
}

export default async function ChurchLayout({ children, params }: LayoutProps<"/c/[church]">) {
  const { church } = await params;
  return <AppShell slug={church}>{children}</AppShell>;
}
