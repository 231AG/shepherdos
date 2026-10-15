import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Coins, MessageSquareText, WifiOff } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: { absolute: "Church Connect: church management for Liberian churches" },
};

const POINTS = [
  {
    icon: Building2,
    title: "Many churches, one platform",
    body: "Each church gets its own space. Staff only ever see their own church's members, attendance and giving.",
    tone: "navy",
  },
  {
    icon: WifiOff,
    title: "Sunday check-in works offline",
    body: "Ushers keep checking people in when the network drops. Everything syncs once the phone reconnects.",
    tone: "gold",
  },
  {
    icon: Coins,
    title: "LRD and USD kept separate",
    body: "Giving is recorded in either currency and never added together. Posted entries can't be edited, only reversed with a reason.",
    tone: "white",
  },
  {
    icon: MessageSquareText,
    title: "SMS to members",
    body: "Message everyone, a department or the members you pick. Costs are shown before you send.",
    tone: "white",
  },
] as const;

export default function Landing() {
  return (
    <div className="min-h-dvh bg-cloud">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <ButtonLink href="/demo/" size="sm" variant="secondary">
          Start the demo
        </ButtonLink>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:gap-12 lg:pb-24 lg:pt-16">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
              Church management for Liberian churches
            </h1>
            <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-ink">
              Members, Sunday check-in, giving and SMS in one secure app that keeps working when the network drops.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/demo/" size="lg" icon={<ArrowRight className="size-5" aria-hidden />} className="flex-row-reverse">
                Start the demo
              </ButtonLink>
            </div>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-overlay">
              {/* Real screenshot of the demo's church dashboard. Regenerate with `npm run shots:landing`. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/dashboard-preview.jpg"
                alt="Church Connect dashboard showing members, Sunday attendance for the last 12 weeks, and October giving in LRD and USD"
                width={1280}
                height={800}
                fetchPriority="high"
                className="block h-auto w-full"
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="why" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-24">
          <h2 id="why" className="max-w-xl text-2xl font-extrabold leading-tight md:text-3xl">
            Made for how churches here actually run
          </h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {POINTS.map(({ icon: Icon, title, body, tone }) => (
              <li
                key={title}
                className={
                  tone === "navy"
                    ? "rounded-2xl bg-navy p-6 text-white md:p-8"
                    : tone === "gold"
                      ? "rounded-2xl bg-gold-soft p-6 md:p-8"
                      : "rounded-2xl border border-line bg-white p-6 md:p-8"
                }
              >
                <Icon className={tone === "navy" ? "size-6 text-gold" : "size-6 text-teal-ink"} aria-hidden />
                <h3 className={`mt-4 text-xl font-bold ${tone === "navy" ? "text-white" : ""}`}>{title}</h3>
                <p className={`mt-2 max-w-md leading-relaxed ${tone === "navy" ? "text-navy-100" : "text-ink"}`}>{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="try" className="border-y border-line bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 id="try" className="text-2xl font-extrabold">
                Explore it as a pastor, secretary, treasurer, department head or ComNet operator
              </h2>
              <p className="mt-2 max-w-2xl text-ink">
                Each role sees a different slice of the same church. Two sample churches show that their data never mixes.
              </p>
            </div>
            <ButtonLink href="/demo/" size="lg" className="shrink-0">
              Start the demo
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
        <p>Prepared for EduBridge Technologies and ComNet IT Solutions.</p>
        <p>
          <Link href="/demo/" className="font-semibold text-teal-ink underline underline-offset-4">Open the demo</Link>
        </p>
      </footer>
    </div>
  );
}
