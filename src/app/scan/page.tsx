import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/design-system/components/button-variants";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/skeleton";
import { issueTicket, verifyTerminalCode } from "@/features/terminal/server";
import { ScanFlow } from "@/features/terminal/scan-flow";
import { requireMember } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Stempeln" };

function Problem({ title, text }: { title: string; text: string }) {
  return (
    <EmptyState
      className="flex-1 justify-center"
      title={title}
      description={text}
      action={<Link href="/app" className={buttonVariants({ size: "lg" })}>Zur App</Link>}
    />
  );
}

async function Scan({ searchParams }: { searchParams: PageProps<"/scan">["searchParams"] }) {
  const viewer = await requireMember();
  const sp = await searchParams;
  const code = typeof sp.c === "string" ? sp.c : "";
  const admin = createAdminClient();

  const res = await verifyTerminalCode(admin, code);
  if (!res.ok) {
    return res.reason === "expired" ? (
      <Problem title="Code abgelaufen" text="Der Code am Terminal wechselt alle 30 Sekunden. Scann ihn einfach noch einmal." />
    ) : (
      <Problem title="Unbekannter Code" text="Dieser QR-Code gehört zu keinem Zeitgeist-Terminal." />
    );
  }
  const t = res.terminal;
  const membership = viewer.memberships.find((m) => m.orgId === t.orgId);
  if (!membership) return <Problem title="Anderes Unternehmen" text="Dieses Terminal gehört nicht zu deiner Firma." />;

  const { data: state } = await admin.rpc("member_stamp_state", { p_membership_id: membership.id });
  const ticket = await issueTicket({ m: membership.id, t: t.id, s: "terminal_qr" });
  return (
    <ScanFlow
      ticket={ticket}
      firstName={membership.displayName.split(" ")[0]}
      locationName={t.locationName}
      state={(state ?? "out") as "out" | "in" | "break"}
    />
  );
}

export default function ScanPage(props: PageProps<"/scan">) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),32px)]">
      <Logo />
      <Suspense fallback={<Skeleton className="mx-auto mt-24 h-64 w-64 rounded-full" />}>
        <Scan searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
