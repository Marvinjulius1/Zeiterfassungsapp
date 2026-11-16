import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descId = `${inputId}-desc`;
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-fg-2">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? descId : undefined}
        className={cn(
          "h-14 w-full rounded-[18px] border border-line bg-surface-2 px-4 text-base text-fg",
          "placeholder:text-fg-3 outline-none transition-colors focus:border-line-strong focus:bg-surface-3",
          error && "border-alert",
          className,
        )}
        {...props}
      />
      {(hint || error) && (
        <p id={descId} className={cn("text-sm", error ? "text-alert" : "text-fg-3")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
