import { cn } from "@/lib/cn";

/**
 * Church Connect brand. This is the only place the logo is drawn.
 * The mark image lives in public/brand/ (cut from the supplied logo with a
 * transparent background). To change the logo: replace those PNGs, adjust
 * the wordmark below if needed, then run `npm run icons` to regenerate the
 * favicon and app icons. See README.
 */

export const BRAND_NAME = "Church Connect";

export function LogoMark({ className, title, size = "md" }: { className?: string; title?: string; size?: "md" | "lg" }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-line", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={size === "lg" ? "/brand/church-connect-mark.png" : "/brand/church-connect-mark-160.png"}
        alt=""
        className="h-[86%] w-[86%] object-contain"
        width={160}
        height={160}
      />
    </span>
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
  if (variant === "mark") return <LogoMark className={cn("size-9", markClassName, className)} title={BRAND_NAME} />;
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={cn("size-9", markClassName)} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-heading text-[17px] font-extrabold tracking-tight", tone === "onDark" ? "text-white" : "text-navy")}>{BRAND_NAME}</span>
        {subtitle && <span className={cn("mt-1 text-[11px] font-medium", tone === "onDark" ? "text-navy-200" : "text-muted")}>{subtitle}</span>}
      </span>
    </span>
  );
}
