import { cn } from "@/lib/cn";
import { RollingNumber } from "./rolling-number";

const sizes = {
  md: "text-[44px] tracking-[-0.03em]",
  lg: "text-[64px] tracking-[-0.04em]",
  xl: "text-[84px] tracking-[-0.045em] sm:text-[104px]",
} as const;

/**
 * Der Star des Screens: große, fette Zahl mit Tabular Numbers.
 */
export function BigNumber({
  value,
  label,
  caption,
  size = "xl",
  rolling = true,
  className,
  ariaLabel,
}: {
  value: string;
  label?: React.ReactNode;
  caption?: React.ReactNode;
  size?: keyof typeof sizes;
  rolling?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      {label && <span className="mb-2 text-sm font-medium text-fg-2">{label}</span>}
      <span className={cn("flex font-semibold leading-none text-fg", sizes[size])}>
        {rolling ? (
          <RollingNumber value={value} aria-label={ariaLabel} />
        ) : (
          <span className="tabular leading-none" aria-label={ariaLabel}>
            {value}
          </span>
        )}
      </span>
      {caption && <span className="mt-3 text-sm text-fg-2">{caption}</span>}
    </div>
  );
}
