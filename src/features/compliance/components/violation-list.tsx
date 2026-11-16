import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ViolationItem {
  id: string;
  severity: "info" | "warning" | "violation";
  message: string;
  law: string | null;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

const style = {
  violation: { icon: ShieldAlert, cls: "text-alert", bg: "bg-alert-soft", label: "Verstoß" },
  warning: { icon: AlertTriangle, cls: "text-pause", bg: "bg-pause-soft", label: "Warnung" },
  info: { icon: Info, cls: "text-fg-2", bg: "bg-surface-2", label: "Hinweis" },
} as const;

export function ViolationList({ items, className }: { items: ViolationItem[]; className?: string }) {
  return (
    <ul className={cn("space-y-2.5", className)}>
      {items.map((v) => {
        const s = style[v.severity];
        const Icon = s.icon;
        return (
          <li key={v.id} className={cn("flex gap-3.5 rounded-[20px] p-4", s.bg)}>
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", s.cls)} aria-label={s.label} />
            <div className="min-w-0 flex-1">
              {v.title && (
                <p className="text-[15px] font-semibold text-fg">
                  {v.title}
                  {v.subtitle && <span className="ml-2 text-sm font-normal text-fg-2">{v.subtitle}</span>}
                </p>
              )}
              <p className={cn("text-sm", v.title ? "mt-0.5 text-fg-2" : "text-[15px] text-fg")}>{v.message}</p>
              {v.law && <p className="mt-1 text-xs font-medium text-fg-3">{v.law}</p>}
            </div>
            {v.action && <div className="shrink-0 self-center">{v.action}</div>}
          </li>
        );
      })}
    </ul>
  );
}
