import { cn } from "@/lib/cn";

type Tone = "neutral" | "ok" | "pause" | "alert" | "inverse";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-2",
  ok: "bg-ok-soft text-ok",
  pause: "bg-pause-soft text-pause",
  alert: "bg-alert-soft text-alert",
  inverse: "bg-inverse text-inverse-fg",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold tabular",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
