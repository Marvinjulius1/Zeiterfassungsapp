"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

type Common = {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  className?: string;
};

const base =
  "flex w-full items-center gap-4 px-1 py-3.5 text-left transition-[transform,background-color] active:scale-[0.99]";

function Inner({ leading, title, subtitle, trailing, chevron }: Common) {
  return (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-fg">{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-sm text-fg-2">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 text-[15px] text-fg-2 tabular">{trailing}</span>}
      {chevron && <ChevronRight className="h-4 w-4 shrink-0 text-fg-3" aria-hidden />}
    </>
  );
}

/** Listenzeile: als Link, Button oder statisch. */
export function ListRow(props: Common & { href?: string; onClick?: () => void }) {
  const { href, onClick, className } = props;
  if (href)
    return (
      <Link href={href} className={cn(base, className)}>
        <Inner {...props} chevron={props.chevron ?? true} />
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cn(base, className)}>
        <Inner {...props} />
      </button>
    );
  return (
    <div className={cn(base, "active:scale-100", className)}>
      <Inner {...props} />
    </div>
  );
}

/** Gruppe von Zeilen mit 1-px-Trennern */
export function ListGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("divide-y divide-line", className)}>{children}</div>;
}
