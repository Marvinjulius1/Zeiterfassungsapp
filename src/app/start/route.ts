import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/roles";

/** Verteiler nach dem Login: je nach Rolle in App, Verwaltung oder Onboarding. */
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  const target = viewer ? homeFor(viewer.active?.role ?? null) : "/login";
  return NextResponse.redirect(new URL(target, request.nextUrl.origin));
}
