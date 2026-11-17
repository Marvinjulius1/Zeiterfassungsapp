import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/design-system/components/skeleton";
import { LocationsManager, type LocationRow } from "@/features/terminal/locations-manager";
import { isOrgAdmin } from "@/lib/auth/roles";
import { requireAdminArea } from "@/lib/auth/session";
import type { GermanState } from "@/lib/germany";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Standorte & Terminals" };

async function Content() {
  const viewer = await requireAdminArea();
  const supabase = await createClient();
  const orgId = viewer.active.orgId;
  const [{ data: locations }, { data: terminals }] = await Promise.all([
    supabase.from("locations").select("id, name, address, state, geofence_lat, geofence_lng, geofence_radius_m").eq("org_id", orgId).is("archived_at", null).order("name"),
    supabase.from("terminals").select("id, name, location_id, last_seen_at, allowed_methods").eq("org_id", orgId).is("revoked_at", null).order("name"),
  ]);
  // Kopplungsstatus liegt in terminal_secrets (für Clients unsichtbar) → service_role, nur Ja/Nein
  const ids = (terminals ?? []).map((t) => t.id);
  const { data: secrets } = ids.length
    ? await createAdminClient().from("terminal_secrets").select("terminal_id, device_token_hash").in("terminal_id", ids)
    : { data: [] };
  const paired = new Set((secrets ?? []).filter((s) => s.device_token_hash).map((s) => s.terminal_id));

  const rows: LocationRow[] = (locations ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    address: l.address,
    state: l.state as GermanState,
    geofence: l.geofence_lat != null && l.geofence_lng != null && l.geofence_radius_m != null ? { lat: l.geofence_lat, lng: l.geofence_lng, radiusM: l.geofence_radius_m } : null,
    terminals: (terminals ?? [])
      .filter((t) => t.location_id === l.id)
      .map((t) => ({ id: t.id, name: t.name, paired: paired.has(t.id), lastSeenAt: t.last_seen_at, methods: t.allowed_methods })),
  }));
  return <LocationsManager locations={rows} canEdit={isOrgAdmin(viewer.active.role)} />;
}

export default function LocationsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Standorte & Terminals" description="Standorte mit Geofence, Tablets am Eingang koppeln – in einer Minute." />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-[24px]" />}>
        <Content />
      </Suspense>
    </div>
  );
}
