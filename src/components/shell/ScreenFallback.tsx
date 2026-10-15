import { Skeleton } from "@/components/ui/misc";

/** Shown while a screen that reads the URL query is rendering on the client. */
export function ScreenFallback() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-96" />
    </div>
  );
}
