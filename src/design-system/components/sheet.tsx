"use client";

import { Drawer } from "vaul";
import { cn } from "@/lib/cn";

/**
 * Bottom-Sheet (mobil per Wischen schließbar). Auf großen Screens zentriert.
 */
export function Sheet({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  className,
}: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-[var(--zg-overlay)] backdrop-blur-[2px]" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col",
            "rounded-t-[28px] border border-b-0 border-line bg-surface outline-none",
            className,
          )}
        >
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-surface-3" aria-hidden />
          <div className="px-6 pt-5">
            <Drawer.Title className="text-xl font-semibold tracking-tight text-fg">{title}</Drawer.Title>
            {description ? (
              <Drawer.Description className="mt-1 text-sm text-fg-2">{description}</Drawer.Description>
            ) : (
              <Drawer.Description className="sr-only">{title}</Drawer.Description>
            )}
          </div>
          <div className="safe-bottom overflow-y-auto px-6 pb-4 pt-5">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
