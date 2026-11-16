import { cva } from "class-variance-authority";

/** Button-Stile – auch serverseitig nutzbar (z. B. für <Link>). */
export const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold " +
    "transition-colors disabled:pointer-events-none disabled:opacity-40 outline-none",
  {
    variants: {
      variant: {
        primary: "bg-inverse text-inverse-fg hover:opacity-90",
        secondary: "bg-surface-2 text-fg hover:bg-surface-3",
        outline: "border border-line-strong text-fg hover:bg-surface-2",
        ghost: "text-fg-2 hover:bg-surface-2 hover:text-fg",
        danger: "bg-alert text-white hover:opacity-90",
      },
      size: {
        sm: "h-9 rounded-full px-4 text-sm",
        md: "h-11 rounded-full px-5 text-[15px]",
        lg: "h-14 rounded-full px-7 text-base",
        xl: "h-16 rounded-[22px] px-8 text-lg",
        icon: "h-11 w-11 rounded-full",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
