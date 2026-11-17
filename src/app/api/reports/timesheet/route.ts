import { type NextRequest } from "next/server";
import { getMonthReport } from "@/features/reports/month-report";
import { monthTitle, renderTimesheetPdf } from "@/features/reports/pdf";
import { fileResponse, logExport, parseMonth } from "@/features/reports/server";
import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Stundenzettel als PDF. Sichtbarkeit regelt RLS:
 * eigene Zeiten, Teamleiter fürs Team, Admins für alle.
 */
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer?.active) return new Response("Nicht angemeldet", { status: 401 });
  const month = parseMonth(request.nextUrl.searchParams.get("monat"));
  const member = request.nextUrl.searchParams.get("person") ?? viewer.active.id;
  if (!month || !/^[0-9a-f-]{36}$/.test(member)) return new Response("Ungültige Anfrage", { status: 400 });

  const supabase = await createClient();
  const report = await getMonthReport(supabase, member, month);
  if (!report) return new Response("Nicht gefunden", { status: 404 });
  const pdf = await renderTimesheetPdf(report);
  if (member !== viewer.active.id) await logExport(viewer.active.orgId, viewer.userId, month, { format: "pdf", membership_id: member });
  return fileResponse(Buffer.from(pdf), `Stundenzettel ${monthTitle(month)} ${report.name}.pdf`, "application/pdf");
}
