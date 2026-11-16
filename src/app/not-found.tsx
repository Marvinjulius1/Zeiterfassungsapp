import Link from "next/link";
import { buttonVariants } from "@/design-system/components/button-variants";
import { EmptyState } from "@/design-system/components/empty-state";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-6">
      <EmptyState
        title="Diese Seite gibt es nicht."
        description="Vielleicht hat sich ein Tippfehler eingeschlichen."
        action={
          <Link href="/" className={buttonVariants({ size: "lg" })}>
            Zur Startseite
          </Link>
        }
      />
    </main>
  );
}
