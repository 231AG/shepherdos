import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Horizontally scrollable on small screens; never overflows the page. */
export function Table({ className, ...rest }: ComponentProps<"table">) {
  return (
    <div className="relative overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...rest} />
    </div>
  );
}

export function THead({ className, ...rest }: ComponentProps<"thead">) {
  return <thead className={cn("bg-cloud text-left", className)} {...rest} />;
}

export function TH({ className, ...rest }: ComponentProps<"th">) {
  return (
    <th
      className={cn("whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted", className)}
      {...rest}
    />
  );
}

export function TR({ className, ...rest }: ComponentProps<"tr">) {
  return <tr className={cn("border-t border-line", className)} {...rest} />;
}

export function TD({ className, ...rest }: ComponentProps<"td">) {
  return <td className={cn("px-3 py-3 align-middle", className)} {...rest} />;
}
