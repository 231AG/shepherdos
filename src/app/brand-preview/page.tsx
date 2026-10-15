import type { Metadata } from "next";
import { LogoMark } from "@/components/brand/Logo";

/** Renders the logo mark full-bleed so `npm run icons` can screenshot it. */
export const metadata: Metadata = { title: "Brand preview", robots: { index: false } };

export default function BrandPreview() {
  return (
    <div className="flex flex-wrap gap-8 bg-white p-8">
      <div id="icon-square" className="size-[512px]">
        <LogoMark className="size-full" />
      </div>
      {/* Maskable icon: mark inside the 80% safe zone on a navy field. */}
      <div id="icon-maskable" className="flex size-[512px] items-center justify-center bg-navy">
        <LogoMark className="size-[340px]" />
      </div>
    </div>
  );
}
