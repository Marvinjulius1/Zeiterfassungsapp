import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseKey, supabaseUrl } from "./env";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Supabase-Client für Client Components (Singleton). */
export function createClient() {
  client ??= createBrowserClient<Database>(supabaseUrl(), supabaseKey());
  return client;
}
