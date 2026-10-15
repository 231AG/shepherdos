import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { RolePicker } from "@/components/shell/RolePicker";

export const metadata: Metadata = { title: "Choose a role" };

export default function DemoSignIn() {
  return (
    <div className="min-h-dvh bg-cloud">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="ShepherdOS demo home">
          <Logo />
        </Link>
        <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-navy hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Back
        </Link>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Who do you want to be?</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink">
          No password needed. You&apos;ll start in Grace Fellowship Church, Paynesville, and can switch role or church at any time.
        </p>
        <div className="mt-8">
          <RolePicker />
        </div>
        <p className="mt-8 flex items-start gap-2.5 text-sm text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-ink" aria-hidden />
          Demo with fictional data. Nothing you do here is real or shared. Your changes stay in this browser until you reset them.
        </p>
      </main>
    </div>
  );
}
