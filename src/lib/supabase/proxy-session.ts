import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { isBrowserOnlyPath, isNativeUserAgent } from "@/lib/native/request";
import { supabaseKey, supabaseUrl } from "./env";

const PROTECTED = ["/app", "/admin", "/onboarding", "/scan"];

/**
 * Erneuert die Supabase-Session bei jeder Anfrage und schützt private Bereiche.
 * Rollenprüfung passiert zusätzlich serverseitig in den Layouts (Defense in Depth).
 */
export async function updateSession(request: NextRequest) {
  // Native App: Verwaltung und Firmen-Anlage gibt es nur im Browser
  if (isNativeUserAgent(request.headers.get("user-agent")) && isBrowserOnlyPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/nur-im-browser";
    url.search = "";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Wichtig: direkt nach dem Erstellen aufrufen, nichts dazwischen.
  const { data } = await supabase.auth.getClaims();
  const isAuthed = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (!isAuthed && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  if (isAuthed && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/start";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
