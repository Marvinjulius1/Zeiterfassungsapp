import { cn } from "@/lib/cn";

export type WorkStatus = "checked_in" | "on_break" | "checked_out" | "absent" | "alert";

const config: Record<WorkStatus, { label: string; dot: string; bg: string; text: string; pulse: boolean }> = {
  checked_in: { label: "Eingecheckt", dot: "bg-ok", bg: "bg-ok-soft", text: "text-ok", pulse: true },
  on_break: { label: "Pause", dot: "bg-pause", bg: "bg-pause-soft", text: "text-pause", pulse: true },
  checked_out: { label: "Ausgecheckt", dot: "bg-fg-3", bg: "bg-surface-2", text: "text-fg-2", pulse: false },
  absent: { label: "Abwesend", dot: "bg-fg-3", bg: "bg-surface-2", text: "text-fg-2", pulse: false },
  alert: { label: "Achtung", dot: "bg-alert", bg: "bg-alert-soft", text: "text-alert", pulse: true },
};

export function StatusPill({
  status,
  label,
  className,
}: {
  status: WorkStatus;
  label?: string;
  className?: string;
}) {
  const c = config[status];
  return (
    <span
      role="status"
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full px-3 text-[13px] font-semibold",
        c.bg,
        c.text,
        className,
      )}
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        {c.pulse && (
          <span
            className={cn("absolute inset-0 rounded-full", c.dot)}
            style={{ animation: "zg-pulse-dot 1.8s ease-out infinite" }}
          />
        )}
        <span className={cn("relative h-2 w-2 rounded-full", c.dot)} />
      </span>
      {label ?? c.label}
    </span>
  );
}
