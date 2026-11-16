"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-[20px] !border !border-line !bg-surface-2 !text-fg !shadow-none !font-sans !text-[15px] !px-4 !py-3.5",
          description: "!text-fg-2",
          success: "[&_[data-icon]]:!text-ok",
          error: "[&_[data-icon]]:!text-alert",
          warning: "[&_[data-icon]]:!text-pause",
        },
      }}
    />
  );
}

export { toast } from "sonner";
