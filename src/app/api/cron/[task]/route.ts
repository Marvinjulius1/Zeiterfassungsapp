import { NextResponse, type NextRequest } from "next/server";
import { runAutoCheckout, runNightlyEvaluation } from "@/features/compliance/jobs";
import { dispatchPendingPush } from "@/lib/push/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Zeitgesteuerte Jobs (z. B. per Vercel Cron oder Supabase pg_cron + pg_net):
 *   GET /api/cron/auto-checkout   stündlich
 *   GET /api/cron/nightly         täglich (z. B. 02:10 Uhr)
 *   GET /api/cron/push            optional alle 5 Min. (verschickt liegengebliebene Push-Nachrichten)
 * Geschützt per „Authorization: Bearer $CRON_SECRET".
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/cron/[task]">) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { task } = await ctx.params;
  const admin = createAdminClient();
  if (task === "auto-checkout") {
    const auto = await runAutoCheckout(admin);
    return NextResponse.json({ ...auto, push: await dispatchPendingPush(admin) });
  }
  if (task === "nightly") {
    const auto = await runAutoCheckout(admin);
    const evaluation = await runNightlyEvaluation(admin);
    return NextResponse.json({ auto, evaluation, push: await dispatchPendingPush(admin) });
  }
  // Fallback: verschickt Benachrichtigungen, deren Versand nach einer Aktion nicht angestoßen wurde
  if (task === "push") return NextResponse.json(await dispatchPendingPush(admin));
  return NextResponse.json({ error: "unknown task" }, { status: 404 });
}
