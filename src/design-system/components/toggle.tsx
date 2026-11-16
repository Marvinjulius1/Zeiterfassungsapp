"use client";

import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";

/**
 * iOS-artiger Schalter. Eigenes, schlankes <button role="switch"> –
 * per Tastatur (Leertaste/Enter) und Screenreader voll bedienbar.
 */
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
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-state={checked ? "checked" : "unchecked"}
      onClick={() => {
        haptic("tick");
        onCheckedChange(!checked);
      }}
      className={cn(
        "relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer items-center rounded-full p-[2px] outline-none",
        "transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "bg-ok" : "bg-surface-3",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "block h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]",
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
