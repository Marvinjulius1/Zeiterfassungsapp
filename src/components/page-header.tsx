import { cn } from "@/lib/cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-sm font-medium text-fg-2">{eyebrow}</p>}
        <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.03em] text-fg">{title}</h1>
        {description && <p className="mt-2 text-[15px] text-fg-2">{description}</p>}
      </div>
      {action}
    </header>
  );
}
