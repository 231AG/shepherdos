import type { Metadata } from "next";
import { LogoMark } from "@/components/brand/Logo";

/** Renders the logo mark full-bleed so `npm run icons` can screenshot it. */
export const metadata: Metadata = { title: "Brand preview", robots: { index: false } };

export default function BrandPreview() {
  return (
    <div className="flex flex-wrap gap-8 bg-cloud p-8">
      <div id="icon-square" className="size-[512px]">
        <LogoMark size="lg" className="size-full rounded-[96px] ring-0" />
      </div>
      {/* Maskable icon: mark inside the 80% safe zone on a white field. */}
      <div id="icon-maskable" className="flex size-[512px] items-center justify-center bg-white">
        <LogoMark size="lg" className="size-[380px] rounded-none ring-0" />
      </div>
    </div>
  );
}
