/**
 * Bewertet alle aktiven Mitgliedschaften (Standard: letzte 50 Tage).
 *   pnpm compliance:run            → alle Firmen
 *   pnpm compliance:run -- 90      → letzte 90 Tage (Demo-Historie reicht 56 Tage)
 */
import { addDaysKey, dateKeyOf } from "@/compliance";
import { evaluateMemberRange } from "@/features/compliance/evaluate-member";
import { createAdminClient } from "@/lib/supabase/admin";

async function main() {
  const days = Number(process.argv[2] ?? 50);
  const admin = createAdminClient();
  const to = dateKeyOf(new Date());
  const from = addDaysKey(to, -days);
  const { data: members, error } = await admin.from("memberships").select("id, display_name").eq("status", "active");
  if (error) throw error;

  let total = 0;
  for (const m of members ?? []) {
    const r = await evaluateMemberRange(admin, m.id, from, to);
    const count = [...r.violations.values()].reduce((s, l) => s + l.length, 0);
    total += count;
    console.log(`✓ ${m.display_name.padEnd(18)} ${String(r.days.size).padStart(3)} Tage · ${count} Hinweise`);
  }
  console.log(`\n${members?.length ?? 0} Personen bewertet, ${total} Hinweise gespeichert (${from} – ${to}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
