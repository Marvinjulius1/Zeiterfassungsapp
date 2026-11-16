import { NextResponse, type NextRequest } from "next/server";
import { runAutoCheckout, runNightlyEvaluation } from "@/features/compliance/jobs";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Zeitgesteuerte Jobs (z. B. per Vercel Cron oder Supabase pg_cron + pg_net):
 *   GET /api/cron/auto-checkout   stündlich
 *   GET /api/cron/nightly         täglich (z. B. 02:10 Uhr)
 * Geschützt per „Authorization: Bearer $CRON_SECRET".
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/cron/[task]">) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { task } = await ctx.params;
  const admin = createAdminClient();
  if (task === "auto-checkout") return NextResponse.json(await runAutoCheckout(admin));
  if (task === "nightly") {
    const auto = await runAutoCheckout(admin);
    const evaluation = await runNightlyEvaluation(admin);
    return NextResponse.json({ auto, evaluation });
  }
  return NextResponse.json({ error: "unknown task" }, { status: 404 });
}
