import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/design-system/components/button-variants";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/skeleton";
import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AcceptButton } from "./accept-button";

export const metadata: Metadata = { title: "Einladung" };

async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data }, viewer] = await Promise.all([
    supabase.rpc("get_invitation_preview", { p_token: token }),
    getViewer(),
  ]);
  const invite = data?.[0];

  if (!invite || !invite.is_valid) {
    return (
      <EmptyState
        title="Diese Einladung ist abgelaufen."
        description="Bitte deinen Arbeitgeber um einen neuen Link."
        className="flex-1 justify-center"
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-16">
        <p className="text-sm font-medium text-fg-2">Einladung</p>
        <h1 className="mt-2 text-[34px] font-semibold leading-tight tracking-[-0.03em]">
          {invite.org_name} lädt dich ein.
        </h1>
        <p className="mt-3 text-[17px] text-fg-2">
          Hallo {invite.display_name}! Mit Zeitgeist erfasst du deine Arbeitszeit mit einem Fingerdruck.
          {invite.email && <> Die Einladung gilt für {invite.email}.</>}
        </p>
      </div>
      <div className="mt-auto pt-10">
        {viewer ? (
          <AcceptButton token={token} />
        ) : (
          <Link
            href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
            className={buttonVariants({ size: "lg", block: true })}
          >
            Anmelden & annehmen
          </Link>
        )}
      </div>
    </div>
  );
}

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),40px)]">
      <Logo />
      <Suspense fallback={<Skeleton className="mt-16 h-40" />}>
        <Invitation params={params} />
      </Suspense>
    </main>
  );
}
