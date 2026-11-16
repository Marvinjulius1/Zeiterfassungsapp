"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { motion } from "motion/react";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "./button-variants";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { spring, tap } from "../motion";

type MotionButtonProps = Omit<
  ComponentPropsWithoutRef<typeof motion.button>,
  "children"
> & { children?: React.ReactNode };

export interface ButtonProps extends MotionButtonProps, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  /** Haptisches Feedback beim Tippen (Standard: an) */
  haptics?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, loading, haptics = true, children, disabled, onClick, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={tap}
      transition={spring.snappy}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (haptics) haptic("tick");
        onClick?.(e);
      }}
      {...props}
    >
      <span className={cn("inline-flex items-center gap-2", loading && "opacity-0")}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <LoadingDots />
        </span>
      )}
    </motion.button>
  );
});

/** Dezente Lade-Punkte statt Spinner */
export function LoadingDots({ className }: { className?: string }) {
  return (
    <span className={cn("flex gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

