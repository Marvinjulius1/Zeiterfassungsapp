import { type NextRequest } from "next/server";
import { datevLodas, datevPnr, dateDe, hhmm, hoursDe, toCsv, type PayrollLine } from "@/features/reports/export-core";
import { getMonthReport, type MonthReport } from "@/features/reports/month-report";
import { resolvePayrollSettings } from "@/features/reports/payroll-settings";
import { fileResponse, logExport, parseMonth } from "@/features/reports/server";
import { renderXlsx } from "@/features/reports/xlsx";
import { canAccessAdmin, isOrgAdmin } from "@/lib/auth/roles";
import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/time/berlin";

const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Monatsexport für die Lohnabrechnung: CSV, Excel oder DATEV LODAS */
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer?.active || !canAccessAdmin(viewer.active.role)) return new Response("Keine Berechtigung", { status: 403 });
  const sp = request.nextUrl.searchParams;
  const month = parseMonth(sp.get("monat"));
  const format = sp.get("format");
  if (!month || !["csv", "xlsx", "datev"].includes(format ?? "")) return new Response("Ungültige Anfrage", { status: 400 });
  if (format === "datev" && !isOrgAdmin(viewer.active.role)) return new Response("Nur Owner und Admins", { status: 403 });

  const supabase = await createClient();
  const orgId = viewer.active.orgId;
  let q = supabase.from("memberships").select("id").eq("org_id", orgId).neq("status", "invited").order("display_name");
  const loc = sp.get("standort");
  if (loc) q = q.eq("location_id", loc);
  const { data: members } = await q;
  const reports = (await Promise.all((members ?? []).map((m) => getMonthReport(supabase, m.id, month)))).filter(
    (r): r is MonthReport => !!r && (r.totals.target > 0 || r.totals.valued > 0 || r.totals.credit > 0),
  );
  const ym = month.slice(0, 7);
  await logExport(orgId, viewer.userId, month, { format, count: reports.length, location: loc });

  if (format === "csv") {
    const rows: (string | number)[][] = [
      ["Pers.-Nr.", "Name", "Datum", "Tag", "Beginn", "Ende", "Pause", "Ist (h)", "Gutschrift (h)", "Soll (h)", "Saldo (h:mm)", "Nacht (h)", "Sonntag (h)", "Feiertag (h)", "Bemerkung"],
    ];
    for (const r of reports) {
      for (const d of r.days) {
        if (!d.targetMinutes && !d.valuedMinutes && !d.creditMinutes && !d.note) continue;
        rows.push([
          r.employeeNo ?? "", r.name, dateDe(d.date), WD[d.weekday - 1],
          d.firstIn ? formatTime(d.firstIn) : "", d.lastOut ? formatTime(d.lastOut) : "",
          hhmm(d.breakMinutes), hoursDe(d.valuedMinutes), hoursDe(d.creditMinutes), hoursDe(d.targetMinutes), hhmm(d.diffMinutes),
          hoursDe(d.night), hoursDe(d.sunday), hoursDe(d.holiday), d.note,
        ]);
      }
    }
    return fileResponse(toCsv(rows), `Zeitgeist Zeiten ${ym}.csv`, "text/csv; charset=utf-8");
  }

  if (format === "xlsx") {
    const buf = await renderXlsx(reports, viewer.active.orgName);
    return fileResponse(new Uint8Array(buf), `Zeitgeist Zeiten ${ym}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  // DATEV
  const { data: org } = await supabase.from("organizations").select("payroll_settings").eq("id", orgId).single();
  const settings = resolvePayrollSettings(org?.payroll_settings);
  const missing: string[] = [];
  const lines: PayrollLine[] = [];
  for (const r of reports) {
    const pnr = datevPnr(r.employeeNo);
    if (!pnr) {
      missing.push(r.name);
      continue;
    }
    const t = r.totals;
    lines.push({
      personnelNo: pnr,
      name: r.name,
      minutes: { worked: t.valued, overtime: Math.max(0, t.diff), night: t.night, sunday: t.sunday, holiday: t.holiday, vacation: t.vacationMinutes, sick: t.sickMinutes },
    });
  }
  return fileResponse(datevLodas(settings, month, lines), `DATEV LODAS ${ym}.txt`, "text/plain; charset=windows-1252", {
    "X-Zeitgeist-Missing-Personnel-No": encodeURIComponent(missing.join(", ")),
  });
}
