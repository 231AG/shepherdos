import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";

/** Shown when a role opens a URL it is not allowed to see. */
export function NoAccess({
  body,
  primary,
}: {
  body: ReactNode;
  primary?: { href: string; label: string };
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-navy-50 text-navy">
        <Lock className="size-6" aria-hidden />
      </div>
      <h1 className="text-2xl font-bold">Your role doesn&apos;t have access to this</h1>
      <div className="mt-2 text-[15px] leading-relaxed text-muted">{body}</div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {primary && <ButtonLink href={primary.href}>{primary.label}</ButtonLink>}
        <ButtonLink href="/demo/" variant="secondary">
          Switch role
        </ButtonLink>
      </div>
    </div>
  );
}
