import Link from "next/link";
import { buttonVariants } from "@/design-system/components/button-variants";
import { EmptyState } from "@/design-system/components/empty-state";

export default function Forbidden() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-6">
      <EmptyState
        title="Kein Zugriff"
        description="Dieser Bereich ist für Admins und Teamleiter. Frag deinen Arbeitgeber, wenn du hier etwas brauchst."
        action={
          <Link href="/app" className={buttonVariants({ size: "lg" })}>
            Zur App
          </Link>
        }
      />
    </main>
  );
}
