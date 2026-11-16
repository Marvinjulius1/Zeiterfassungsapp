"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design-system/components/button";
import { toast } from "@/design-system/components/toaster";
import { haptic } from "@/lib/haptics";
import { acceptInvitation } from "../actions";

export function AcceptButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      block
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await acceptInvitation(token);
          if (!res.ok) {
            haptic("error");
            toast.error(res.error);
            return;
          }
          haptic("success");
          toast.success("Willkommen im Team!");
          router.replace("/app");
        })
      }
    >
      Einladung annehmen
    </Button>
  );
}
