import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/roles";
import { isNativeUserAgent, nativeHomeFor } from "@/lib/native/request";

/**
 * Verteiler nach dem Login: je nach Rolle in App, Verwaltung oder Onboarding.
 * In der nativen App landen alle in der Zeiterfassung – verwaltet wird nur im Browser.
 */
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  const native = isNativeUserAgent(request.headers.get("user-agent"));
  const target = !viewer ? "/login" : native ? nativeHomeFor(!!viewer.active) : homeFor(viewer.active?.role ?? null);
  return NextResponse.redirect(new URL(target, request.nextUrl.origin));
}
