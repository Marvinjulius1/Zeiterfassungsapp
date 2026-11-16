"use client";

import { Slider as RSlider } from "radix-ui";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  className,
}: {
  value: number;
  onValueChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  className?: string;
}) {
  return (
    <RSlider.Root
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([v]) => {
        if (v !== value) haptic("tick");
        onValueChange(v);
      }}
      className={cn("relative flex h-8 w-full touch-none select-none items-center", className)}
    >
      <RSlider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-3">
        <RSlider.Range className="absolute h-full rounded-full bg-fg" />
      </RSlider.Track>
      <RSlider.Thumb
        aria-label={label}
        className="block h-7 w-7 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.35)] outline-none transition-transform active:scale-110"
      />
    </RSlider.Root>
  );
}
