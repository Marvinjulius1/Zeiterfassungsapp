"use client";

import { Stepper } from "@/design-system/components/stepper";
import { Toggle } from "@/design-system/components/toggle";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import type { ContractInput } from "../actions";

export const CONTRACT_TYPES = [
  { value: "full_time", label: "Vollzeit" },
  { value: "part_time", label: "Teilzeit" },
  { value: "minijob", label: "Minijob" },
  { value: "apprentice", label: "Azubi" },
  { value: "working_student", label: "Werkstudent" },
] as const;

const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export type ContractState = Required<ContractInput>;

export const DEFAULT_CONTRACT: ContractState = {
  type: "full_time",
  weeklyHours: 40,
  workDays: [1, 2, 3, 4, 5],
  vacationDays: 28,
  schoolDays: [],
  trustBased: false,
};

/** Sinnvolle Vorgaben je Vertragsart */
export function presetFor(type: ContractState["type"]): Partial<ContractState> {
  switch (type) {
    case "minijob":
      return { weeklyHours: 9, workDays: [5, 6], vacationDays: 10 };
    case "part_time":
      return { weeklyHours: 20, workDays: [1, 2, 3, 4, 5], vacationDays: 28 };
    case "apprentice":
      return { weeklyHours: 40, workDays: [1, 2, 3, 4, 5], vacationDays: 30 };
    case "working_student":
      return { weeklyHours: 20, workDays: [1, 3, 5], vacationDays: 20 };
    default:
      return { weeklyHours: 40, workDays: [1, 2, 3, 4, 5], vacationDays: 28 };
  }
}

export function Chips<T extends string | number>({
  options,
  selected,
  onToggle,
  label,
}: {
  options: readonly { value: T; label: string }[];
  selected: readonly T[];
  onToggle: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            onClick={() => {
              haptic("tick");
              onToggle(o.value);
            }}
            className={cn(
              "h-10 min-w-10 rounded-full px-3.5 text-sm font-semibold transition-[background-color,color,transform] active:scale-95",
              on ? "bg-inverse text-inverse-fg" : "bg-surface-2 text-fg-2 hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ContractFields({ value, onChange }: { value: ContractState; onChange: (v: ContractState) => void }) {
  const set = (patch: Partial<ContractState>) => onChange({ ...value, ...patch });
  const toggleDay = (list: number[], d: number) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort());
  const perDay = value.workDays.length ? value.weeklyHours / value.workDays.length : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-medium text-fg-2">Vertragsart</p>
        <Chips
          label="Vertragsart"
          options={CONTRACT_TYPES}
          selected={[value.type]}
          onToggle={(t) => set({ type: t, ...presetFor(t) })}
        />
      </div>

      <p className="text-[16px] leading-[2.6]">
        <Stepper label="Wochenstunden" value={value.weeklyHours} min={0} max={48} onChange={(v) => set({ weeklyHours: v })} /> Stunden pro
        Woche, verteilt auf
      </p>
      <Chips
        label="Arbeitstage"
        options={DAYS.map((l, i) => ({ value: i + 1, label: l }))}
        selected={value.workDays}
        onToggle={(d) => set({ workDays: toggleDay(value.workDays, d) })}
      />
      {value.workDays.length > 0 && (
        <p className="text-sm text-fg-3">
          = {perDay.toLocaleString("de-DE", { maximumFractionDigits: 2 })} h Soll pro Arbeitstag
        </p>
      )}

      <p className="text-[16px] leading-[2.6]">
        <Stepper label="Urlaubstage" value={value.vacationDays} min={0} max={60} onChange={(v) => set({ vacationDays: v })} /> Urlaubstage
        pro Jahr
      </p>

      {value.type === "apprentice" && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-fg-2">Berufsschultage</p>
          <Chips
            label="Berufsschultage"
            options={DAYS.slice(0, 6).map((l, i) => ({ value: i + 1, label: l }))}
            selected={value.schoolDays}
            onToggle={(d) => set({ schoolDays: toggleDay(value.schoolDays, d) })}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[15px] font-medium">Vertrauensarbeitszeit</p>
          <p className="text-sm text-fg-2">Erfassen ja, Beginn und Ende werden nicht kontrolliert.</p>
        </div>
        <Toggle checked={value.trustBased} onCheckedChange={(v) => set({ trustBased: v })} label="Vertrauensarbeitszeit" />
      </div>
    </div>
  );
}
