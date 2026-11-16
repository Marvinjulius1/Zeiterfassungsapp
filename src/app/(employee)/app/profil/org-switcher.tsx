"use client";

import { useTransition } from "react";
import { switchOrganization } from "@/lib/auth/actions";

export function OrgSwitcher({ active, options }: { active: string; options: { value: string; label: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-[15px] font-medium">Firma wechseln</span>
      <select
        disabled={pending}
        defaultValue={active}
        onChange={(e) => start(() => switchOrganization(e.target.value))}
        className="h-10 rounded-full border border-line bg-surface-2 px-4 text-sm text-fg"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
