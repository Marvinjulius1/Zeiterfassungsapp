/** Typen und Konstanten, die Server- und Client-Komponenten teilen. */
import type { MemberRole } from "@/lib/auth/roles";

export type ContractType = "minijob" | "part_time" | "full_time" | "apprentice" | "working_student";

export const CONTRACT_LABEL: Record<ContractType, string> = {
  full_time: "Vollzeit",
  part_time: "Teilzeit",
  minijob: "Minijob",
  apprentice: "Azubi",
  working_student: "Werkstudent",
};

export interface MemberRow {
  id: string;
  name: string;
  email: string | null;
  role: MemberRole;
  status: "invited" | "active" | "archived";
  locationId: string | null;
  locationName: string | null;
  teamId: string | null;
  teamName: string | null;
  contractType: ContractType | null;
  weeklyMinutes: number | null;
  employeeNo: string | null;
}

export interface Option {
  id: string;
  name: string;
}
