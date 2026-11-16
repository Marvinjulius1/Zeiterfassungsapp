"use client";

import { Switch } from "radix-ui";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";

export function Toggle({
  checked,
  onCheckedChange,
  disabled,
  id,
  label,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  /** Screenreader-Label, falls kein sichtbares <label> existiert */
  label?: string;
  className?: string;
}) {
  return (
    <Switch.Root
      id={id}
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onCheckedChange={(v) => {
        haptic("tick");
        onCheckedChange(v);
      }}
      className={cn(
        "relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer items-center rounded-full p-[2px] outline-none",
        "bg-surface-3 transition-colors duration-200 data-[state=checked]:bg-ok disabled:opacity-40",
        className,
      )}
    >
      <Switch.Thumb
        className={cn(
          "block h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]",
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=checked]:translate-x-5",
        )}
      />
    </Switch.Root>
  );
}
