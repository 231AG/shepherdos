"use client";

import { Building2 } from "lucide-react";
import type { ReactNode } from "react";
import { getChurchBySlug, getPersona, getScope, isGrantLive, pendingGrantFor, requestSupportAccess, useDb } from "@/data/repo";
import { canAccessInChurch, type ModuleId } from "@/lib/access";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { SupportBar } from "./SupportBar";
import { useDemoStore } from "@/data/store";
import { Toaster } from "@/components/ui/Toast";
import { Skeleton } from "@/components/ui/misc";
import { Logo } from "@/components/brand/Logo";
import { ChurchContext } from "./ChurchContext";
import { DemoBar } from "./DemoBar";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { OfflineBanner } from "./OfflineBanner";
import { NoAccess } from "./NoAccess";
import { RolePicker } from "./RolePicker";
import { useHydrated } from "./hooks";

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col" aria-busy="true" aria-label="Loading the demo">
      <div className="h-11 bg-navy-950" />
      <div className="flex flex-1">
        <div className="hidden w-[76px] bg-navy md:block lg:w-64" />
        <div className="flex-1 p-4 lg:p-8">
          <Skeleton className="h-8 w-64" />
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="mt-6 h-72" />
        </div>
      </div>
    </div>
  );
}

/** Everything inside /c/[church]/: demo bar, navigation, and the role/church context. */
export function AppShell({ slug, children }: { slug: string; children: ReactNode }) {
  const hydrated = useHydrated();
  if (!hydrated) return <ShellSkeleton />;
  return <HydratedShell slug={slug}>{children}</HydratedShell>;
}

function HydratedShell({ slug, children }: { slug: string; children: ReactNode }) {
  const db = useDb();
  const role = useDemoStore((s) => s.role);
  const supportSession = useDemoStore((s) => s.supportSession);
  const church = getChurchBySlug(db, slug);

  if (!role || !church) {
    return (
      <div className="min-h-dvh">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <Logo />
          <h1 className="mt-8 text-3xl font-bold">Choose a role to continue</h1>
          <p className="mt-2 max-w-xl text-muted">
            This link opens the ShepherdOS demo. Pick who you want to be; you can switch at any time from the bar at the top.
          </p>
          <div className="mt-8">
            <RolePicker churchSlug={slug} />
          </div>
        </div>
        <Toaster />
      </div>
    );
  }

  const grant =
    role === "operator" && supportSession?.churchSlug === slug ? db.support_grants.find((g) => g.id === supportSession.grantId) : undefined;
  const support = grant && isGrantLive(grant, new Date()) ? { grantId: grant.id, expiresAt: grant.expires_at!, approvedBy: grant.approved_by ?? "the church" } : null;

  if (role === "operator" && !support) {
    const pending = pendingGrantFor(db, church.id);
    return (
      <div className="min-h-dvh">
        <DemoBar churchSlug={slug} />
        <main className="px-4">
          <NoAccess
            body={
              <>
                Platform operators can&apos;t open church records directly. They need a time-limited support grant approved by {church.name}.
                <span className="mt-4 flex flex-col items-center gap-2 text-sm text-navy">
                  <span className="flex items-center gap-2">
                    <Building2 className="size-4" aria-hidden /> Open a church from the Platform console when its grant is active.
                  </span>
                  {pending ? (
                    <span className="font-semibold text-gold-ink">Your request is waiting for the church admin to approve.</span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        requestSupportAccess(church, "General support");
                        toast("Access requested", { body: `${church.short_name}'s pastor can approve it in Settings.` });
                      }}
                    >
                      Request access to {church.short_name}
                    </Button>
                  )}
                </span>
              </>
            }
            primary={{ href: "/platform/", label: "Open Platform console" }}
          />
        </main>
        <Toaster />
      </div>
    );
  }

  const persona = support
    ? { name: "Aaron Sumo", display: "Aaron Sumo", title: "ComNet support · read-only", initials: "AS", department: null }
    : getPersona(db, church.id, role);
  const value = {
    church,
    role,
    persona,
    scope: getScope(db, church.id, role),
    support,
    can: (m: ModuleId) => canAccessInChurch(role, m, church.settings, !!support),
  };
  return (
    <ChurchContext.Provider value={value}>
      <a href="#main" className="sr-only z-50 rounded-lg bg-gold px-4 py-2 font-semibold text-navy focus:not-sr-only focus:fixed focus:left-2 focus:top-2">
        Skip to content
      </a>
      <div className="flex min-h-dvh flex-col">
        <DemoBar churchSlug={slug} />
        <div className="flex flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            {support && <SupportBar church={church} expiresAt={support.expiresAt} approvedBy={support.approvedBy} />}
            <OfflineBanner />
            <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-12 lg:px-8">
              {children}
            </main>
          </div>
        </div>
        <BottomNav />
      </div>
      <Toaster />
    </ChurchContext.Provider>
  );
}
