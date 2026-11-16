import { addDaysKey, autoCheckoutAt, dateKeyOf } from "@/compliance";
import type { AdminClient } from "@/lib/supabase/admin";
import { evaluateMemberRange, loadMemberContext } from "./evaluate-member";

/**
 * Beendet vergessene Arbeitsblöcke gemäß Firmenregel (Standard: nach 12 h)
 * und benachrichtigt die Person. Läuft stündlich.
 */
export async function runAutoCheckout(admin: AdminClient, now = new Date()) {
  const since = new Date(now.getTime() - 3 * 86400000).toISOString();
  const { data: events, error } = await admin
    .from("time_events")
    .select("membership_id, kind, occurred_at, work_date")
    .is("voided_at", null)
    .gte("occurred_at", since)
    .order("occurred_at");
  if (error) throw error;

  // letzter Zustand je Mitgliedschaft
  const last = new Map<string, { kind: string; checkIn: Date | null; workDate: string }>();
  for (const e of events ?? []) {
    const prev = last.get(e.membership_id);
    last.set(e.membership_id, {
      kind: e.kind,
      checkIn: e.kind === "check_in" ? new Date(e.occurred_at) : e.kind === "check_out" ? null : (prev?.checkIn ?? null),
      workDate: e.work_date,
    });
  }

  const closed: string[] = [];
  for (const [membershipId, s] of last) {
    if (s.kind === "check_out" || !s.checkIn) continue;
    const ctx = await loadMemberContext(admin, membershipId);
    const at = autoCheckoutAt(s.checkIn, now, ctx.rules.autoCheckout);
    if (!at) continue;

    const { error: insErr } = await admin.from("time_events").insert({
      id: crypto.randomUUID(),
      org_id: ctx.orgId,
      membership_id: membershipId,
      kind: "check_out",
      occurred_at: at.toISOString(),
      work_date: s.workDate,
      source: "system_auto",
      note: `Automatisch ausgecheckt (Regel: nach ${ctx.rules.autoCheckout.afterHours} h${ctx.rules.autoCheckout.atMidnight ? " bzw. um Mitternacht" : ""})`,
    });
    if (insErr) {
      console.error("Auto-Checkout fehlgeschlagen", membershipId, insErr.message);
      continue;
    }

    const { data: m } = await admin.from("memberships").select("user_id").eq("id", membershipId).single();
    if (m?.user_id) {
      await admin.from("notifications").insert({
        user_id: m.user_id,
        org_id: ctx.orgId,
        kind: "auto_checkout",
        title: "Du wurdest automatisch ausgecheckt",
        body: "Bitte prüfe dein Arbeitsende und beantrage bei Bedarf eine Korrektur.",
        payload: { work_date: s.workDate },
      });
    }
    await evaluateMemberRange(admin, membershipId, s.workDate, dateKeyOf(now), now);
    closed.push(membershipId);
  }
  return { closed: closed.length };
}

/**
 * Nachbewertung der letzten Tage für alle aktiven Mitgliedschaften –
 * erfasst u. a. fehlende Aufzeichnungen (MiLoG) und abgelaufene Ersatzruhetag-Fristen.
 */
export async function runNightlyEvaluation(admin: AdminClient, now = new Date(), days = 16) {
  const to = dateKeyOf(now);
  const from = addDaysKey(to, -days);
  const { data: members, error } = await admin.from("memberships").select("id").eq("status", "active");
  if (error) throw error;
  let violations = 0;
  for (const m of members ?? []) {
    const r = await evaluateMemberRange(admin, m.id, from, to, now);
    violations += [...r.violations.values()].reduce((s, l) => s + l.length, 0);
  }
  return { members: members?.length ?? 0, violations, from, to };
}
