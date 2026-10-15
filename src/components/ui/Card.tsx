import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...rest }: ComponentProps<"section">) {
  return <section className={cn("rounded-2xl border border-line bg-white shadow-card", className)} {...rest} />;
}

export function CardHeader({
  title,
  action,
  subtitle,
  className,
  as: Heading = "h2",
}: {
  title: ReactNode;
  action?: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-5 pt-5", className)}>
      <div className="min-w-0">
        <Heading className="text-[17px] font-bold leading-tight">{title}</Heading>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
