import type { Database } from "@/lib/supabase/database.types";

export type MemberRole = Database["public"]["Enums"]["member_role"];

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  team_lead: "Teamleiter",
  employee: "Mitarbeiter",
};

/** Wer darf in die Verwaltung? */
export const ADMIN_AREA_ROLES: readonly MemberRole[] = ["owner", "admin", "team_lead"];

export function canAccessAdmin(role: MemberRole): boolean {
  return ADMIN_AREA_ROLES.includes(role);
}

export function isOrgAdmin(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

/** Startseite nach dem Login je nach Rolle */
export function homeFor(role: MemberRole | null): "/app" | "/admin" | "/onboarding" {
  if (!role) return "/onboarding";
  return canAccessAdmin(role) ? "/admin" : "/app";
}
