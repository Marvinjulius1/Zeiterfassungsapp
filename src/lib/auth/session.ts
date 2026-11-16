import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccessAdmin, type MemberRole } from "./roles";

export const ACTIVE_ORG_COOKIE = "zg_org";

export interface ViewerMembership {
  id: string;
  orgId: string;
  orgName: string;
  role: MemberRole;
  displayName: string;
}

export interface Viewer {
  userId: string;
  email: string;
  fullName: string;
  memberships: ViewerMembership[];
  /** aktuell gewählte Firma */
  active: ViewerMembership | null;
}

/**
 * Data Access Layer: liest Session + Mitgliedschaften genau einmal pro Request.
 * Muss innerhalb einer <Suspense>-Grenze aufgerufen werden (liest Cookies).
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle(),
    supabase
      .from("memberships")
      .select("id, org_id, role, display_name, organizations(name)")
      .eq("user_id", auth.user.id)
      .eq("status", "active")
      .order("created_at"),
  ]);

  const memberships: ViewerMembership[] = (rows ?? []).map((m) => ({
    id: m.id,
    orgId: m.org_id,
    orgName: m.organizations?.name ?? "",
    role: m.role,
    displayName: m.display_name,
  }));

  const preferred = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const active = memberships.find((m) => m.orgId === preferred) ?? memberships[0] ?? null;

  return {
    userId: auth.user.id,
    email: auth.user.email ?? "",
    fullName: profile?.full_name || active?.displayName || "",
    memberships,
    active,
  };
});

/** Für die Mitarbeiter-App: angemeldet + Mitglied einer Firma. */
export async function requireMember(): Promise<Viewer & { active: ViewerMembership }> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.active) redirect("/onboarding");
  return viewer as Viewer & { active: ViewerMembership };
}

/** Für die Verwaltung: Owner, Admin oder Teamleiter. */
export async function requireAdminArea(): Promise<Viewer & { active: ViewerMembership }> {
  const viewer = await requireMember();
  if (!canAccessAdmin(viewer.active.role)) forbidden();
  return viewer;
}
