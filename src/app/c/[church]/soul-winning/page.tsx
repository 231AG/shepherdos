import type { Metadata } from "next";
import { SoulWinningScreen } from "@/features/soulwinning/SoulWinningScreen";

export const metadata: Metadata = { title: "Soul-winning" };

export default function Page() {
  return <SoulWinningScreen />;
}
