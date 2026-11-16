import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseKey, supabaseUrl } from "./env";

/** Supabase-Client für Server Components, Server Actions und Route Handler. */
export async function createClient() {
  // Supabase prüft Token-Ablaufzeiten mit Date.now() → nur zur Request-Zeit ausführen.
  await connection();
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // In Server Components nicht erlaubt – der Proxy erneuert die Session.
        }
      },
    },
  });
}
