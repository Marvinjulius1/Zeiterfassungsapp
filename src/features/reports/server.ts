import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

/** Datei-Antwort mit sicherem, UTF-8-fähigem Dateinamen */
export function fileResponse(body: BodyInit, filename: string, type: string, extraHeaders: Record<string, string> = {}) {
  const ascii = filename.normalize("NFKD").replace(/[^\x20-\x7E]/g, "").replace(/["\\]/g, "");
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

/** Exporte von Personaldaten werden im Audit-Log festgehalten (DSGVO-Rechenschaft). */
export async function logExport(orgId: string, actorId: string, month: string, details: { [key: string]: Json | undefined }) {
  await createAdminClient().from("audit_log").insert({
    org_id: orgId,
    actor_id: actorId,
    actor_kind: "user",
    entity: "report",
    entity_id: month,
    action: "export",
    new_value: details,
    hash: "", // wird vom Trigger berechnet
  });
}

export function parseMonth(v: string | null): string | null {
  return v && /^\d{4}-\d{2}$/.test(v) ? `${v}-01` : null;
}
