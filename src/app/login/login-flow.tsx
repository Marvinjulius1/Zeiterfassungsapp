"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/design-system/components/button";
import { Input } from "@/design-system/components/input";
import { toast } from "@/design-system/components/toaster";
import { spring } from "@/design-system/motion";
import { haptic } from "@/lib/haptics";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/auth/safe-next";
import { DemoLogins } from "./demo-logins";

type Step = "email" | "code";

export function LoginFlow({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "link" ? "Der Link ist abgelaufen. Fordere einfach einen neuen an." : null,
  );

  async function sendLink(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setLoading(false);
    if (error) {
      setError(error.status === 429 ? "Zu viele Versuche. Bitte warte kurz." : "Das hat nicht geklappt. Prüfe die E-Mail-Adresse.");
      haptic("error");
      return;
    }
    haptic("success");
    setStep("code");
  }

  async function verify(token: string) {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
    if (error) {
      setLoading(false);
      setCode("");
      setError("Der Code stimmt nicht oder ist abgelaufen.");
      haptic("error");
      return;
    }
    haptic("success");
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="mt-16 flex flex-1 flex-col">
      <AnimatePresence mode="wait" initial={false}>
        {step === "email" ? (
          <motion.form
            key="email"
            onSubmit={sendLink}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={spring.gentle}
            className="flex flex-col"
          >
            <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.03em]">Willkommen.</h1>
            <p className="mt-2 text-[17px] text-fg-2">Melde dich mit deiner E-Mail an. Kein Passwort nötig.</p>
            <div className="mt-10">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                required
                label="E-Mail"
                placeholder="du@firma.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error ?? undefined}
              />
            </div>
            <Button type="submit" size="lg" block className="mt-6" loading={loading} disabled={!email.includes("@")}>
              <Mail className="h-5 w-5" aria-hidden /> Link & Code senden
            </Button>
          </motion.form>
        ) : (
          <motion.div
            key="code"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={spring.gentle}
            className="flex flex-col"
          >
            <button
              type="button"
              onClick={() => setStep("email")}
              className="-ml-1 mb-8 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-fg-2 hover:text-fg"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> Andere E-Mail
            </button>
            <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.03em]">Schau in dein Postfach.</h1>
            <p className="mt-2 text-[17px] text-fg-2">
              Tippe auf den Link in der Mail an <span className="text-fg">{email}</span> – oder gib den 6-stelligen Code ein.
            </p>
            <label htmlFor="otp" className="sr-only">
              6-stelliger Code
            </label>
            <input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              autoFocus
              value={code}
              disabled={loading}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "otp-error" : undefined}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                if (v.length === 6) void verify(v);
              }}
              placeholder="000000"
              className="tabular mt-10 h-20 w-full rounded-[22px] border border-line bg-surface-2 text-center text-[40px] font-semibold tracking-[0.4em] text-fg outline-none placeholder:text-fg-3/40 focus:border-line-strong"
            />
            {error && (
              <p id="otp-error" role="alert" className="mt-3 text-sm text-alert">
                {error}
              </p>
            )}
            <Button
              variant="ghost"
              className="mt-6 self-center"
              onClick={() => {
                void sendLink();
                toast.success("Neuer Code ist unterwegs.");
              }}
            >
              Code erneut senden
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {demoMode && step === "email" && <DemoLogins next={next} />}
    </div>
  );
}
