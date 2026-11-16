import { cn } from "@/lib/cn";

/** Wortmarke: schlicht, mit einem „Sekunden-Punkt". */
export function Logo({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("inline-flex items-baseline font-semibold tracking-[-0.04em] text-fg", className)}
      style={{ fontSize: size }}
    >
      zeitgeist
      <span className="ml-[0.08em] inline-block h-[0.22em] w-[0.22em] rounded-full bg-ok" aria-hidden />
    </span>
  );
}
