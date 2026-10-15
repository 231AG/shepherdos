import { cn } from "@/lib/cn";

/**
 * PLACEHOLDER LOGO. This is the only place the brand mark is drawn.
 * To swap in the real logo: replace the <svg> in `LogoMark` (keep the
 * square viewBox), adjust the wordmark if needed, then run
 * `npm run icons` to regenerate the favicon and PWA icons. See README.
 */

export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("shrink-0", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect width="32" height="32" rx="8" className="fill-gold" />
      {/* Shepherd's crook */}
      <path
        d="M13 26.5V12.5a5 5 0 0 1 10 0v1.75"
        fill="none"
        className="stroke-navy"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23" cy="17.4" r="1.6" className="fill-navy" />
    </svg>
  );
}

export function Logo({
  variant = "full",
  tone = "onLight",
  className,
  markClassName,
  subtitle,
}: {
  variant?: "full" | "mark";
  /** Wordmark colour: navy on light backgrounds, white on navy. */
  tone?: "onLight" | "onDark";
  className?: string;
  markClassName?: string;
  subtitle?: string;
}) {
  if (variant === "mark") return <LogoMark className={cn("size-8", markClassName, className)} title="ShepherdOS" />;
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={cn("size-8", markClassName)} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-heading text-[17px] font-extrabold tracking-tight", tone === "onDark" ? "text-white" : "text-navy")}>
          ShepherdOS
        </span>
        {subtitle && <span className={cn("mt-1 text-[11px] font-medium", tone === "onDark" ? "text-navy-200" : "text-muted")}>{subtitle}</span>}
      </span>
    </span>
  );
}
