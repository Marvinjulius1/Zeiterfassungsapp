"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { toast } from "@/design-system/components/toaster";
import { createClient } from "@/lib/supabase/client";

const DEMO_PASSWORD = "zeitgeist-demo";

const accounts = [
  { email: "owner@zeitgeist.demo", name: "Alex Becker", role: "Owner" },
  { email: "admin@zeitgeist.demo", name: "Sophie Wagner", role: "Admin" },
  { email: "teamlead@zeitgeist.demo", name: "Jonas Hoffmann", role: "Teamleiter" },
  { email: "marvin@zeitgeist.demo", name: "Marvin Julius", role: "Azubi" },
  { email: "noah@zeitgeist.demo", name: "Noah Klein", role: "Azubi, 17" },
  { email: "tim@zeitgeist.demo", name: "Tim Neumann", role: "Minijob" },
] as const;

/** Nur lokal (NEXT_PUBLIC_DEMO_MODE=true): Ein-Tipp-Login für die Demo-Daten. */
export function DemoLogins({ next }: { next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function login(email: string) {
    setBusy(email);
    const { error } = await createClient().auth.signInWithPassword({ email, password: DEMO_PASSWORD });
    if (error) {
      setBusy(null);
      toast.error("Demo-Login fehlgeschlagen", { description: "Läuft Supabase lokal? → pnpm db:start" });
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <section aria-labelledby="demo-title" className="mt-auto pt-14">
      <div className="mb-3 flex items-center gap-2">
        <h2 id="demo-title" className="text-sm font-semibold text-fg-2">
          Demo-Zugänge
        </h2>
        <Badge>nur lokal</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {accounts.map((a) => (
          <button
            key={a.email}
            type="button"
            disabled={busy !== null}
            onClick={() => login(a.email)}
            className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3 text-left transition-transform active:scale-[0.97] disabled:opacity-50"
          >
            <Avatar name={a.name} size={34} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-fg">{busy === a.email ? "Anmelden …" : a.name}</span>
              <span className="block truncate text-xs text-fg-2">{a.role}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
