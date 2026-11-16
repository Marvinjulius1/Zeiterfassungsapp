"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/design-system/components/button";
import { Sheet } from "@/design-system/components/sheet";
import { AdminNav } from "./admin-nav";

/** Kompakte Kopfzeile + Menü-Sheet für die Verwaltung auf kleinen Screens. */
export function AdminMobileBar() {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-[color-mix(in_srgb,var(--zg-bg)_85%,transparent)] px-4 backdrop-blur-xl lg:hidden">
      <Logo size={19} />
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Verwaltung"
        trigger={
          <Button variant="ghost" size="icon" aria-label="Menü öffnen">
            <Menu className="h-5 w-5" aria-hidden />
          </Button>
        }
      >
        <AdminNav onNavigate={() => setOpen(false)} />
      </Sheet>
    </div>
  );
}
