"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/design-system/components/button";
import { Input } from "@/design-system/components/input";
import { spring } from "@/design-system/motion";
import { GERMAN_STATES, type GermanState } from "@/lib/germany";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/cn";
import { createOrganization } from "./actions";

const STEPS = 3;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [state, setState] = useState<GermanState>("NW");
  const [locationName, setLocationName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setError(null);
    setStep(to);
  };

  const canNext =
    (step === 0 && companyName.trim().length >= 2) ||
    (step === 1 && locationName.trim().length >= 1) ||
    (step === 2 && displayName.trim().length >= 2);

  function submit() {
    start(async () => {
      const res = await createOrganization({ companyName, state, locationName, displayName });
      if (!res.ok) {
        haptic("error");
        setError(res.error);
        return;
      }
      haptic("success");
      setDone(true);
    });
  }

  if (done) {
    return (
      <motion.div
        className="flex flex-1 flex-col items-center justify-center text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.span
          className="flex h-24 w-24 items-center justify-center rounded-full bg-ok"
          initial={{ scale: 0.3, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 14 }}
        >
          <Check className="h-12 w-12 text-bg" strokeWidth={3} aria-hidden />
        </motion.span>
        <h1 className="mt-8 text-[32px] font-semibold tracking-[-0.03em]">{companyName} ist startklar.</h1>
        <p className="mt-2 text-fg-2">Als Nächstes lädst du dein Team ein.</p>
        <Button size="lg" className="mt-10" onClick={() => router.replace("/admin")}>
          Zur Verwaltung <ArrowRight className="h-5 w-5" aria-hidden />
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="mt-12 flex flex-1 flex-col">
      {/* Fortschritt */}
      <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step + 1} aria-label={`Schritt ${step + 1} von ${STEPS}`}>
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
            <motion.span
              className="block h-full rounded-full bg-fg"
              initial={false}
              animate={{ width: i <= step ? "100%" : "0%" }}
              transition={spring.gentle}
            />
          </span>
        ))}
      </div>

      <form
        className="mt-10 flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canNext) return;
          if (step < STEPS - 1) go(step + 1);
          else submit();
        }}
      >
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={spring.gentle}
          >
            {step === 0 && (
              <>
                <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.03em]">Wie heißt deine Firma?</h1>
                <p className="mt-2 text-fg-2">Dauert keine zwei Minuten. Versprochen.</p>
                <div className="mt-8 space-y-6">
                  <Input label="Firmenname" autoFocus value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="z. B. Bäckerei Sonnenschein GmbH" />
                  <fieldset>
                    <legend className="mb-3 text-sm font-medium text-fg-2">Bundesland (für Feiertage)</legend>
                    <div className="flex flex-wrap gap-2">
                      {GERMAN_STATES.map((s) => (
                        <button
                          key={s.code}
                          type="button"
                          aria-pressed={state === s.code}
                          title={s.name}
                          onClick={() => {
                            haptic("tick");
                            setState(s.code);
                          }}
                          className={cn(
                            "h-9 rounded-full px-3.5 text-sm font-semibold transition-[background-color,color,transform] active:scale-95",
                            state === s.code ? "bg-inverse text-inverse-fg" : "bg-surface-2 text-fg-2 hover:text-fg",
                          )}
                        >
                          <span aria-hidden>{s.code}</span>
                          <span className="sr-only">{s.name}</span>
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-fg-3">{GERMAN_STATES.find((s) => s.code === state)?.name}</p>
                  </fieldset>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.03em]">Wo arbeitet ihr?</h1>
                <p className="mt-2 text-fg-2">Dein erster Standort. Weitere kannst du später anlegen.</p>
                <div className="mt-8">
                  <Input label="Standort" autoFocus value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="z. B. Filiale Innenstadt" />
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.03em]">Und wie heißt du?</h1>
                <p className="mt-2 text-fg-2">So sieht dich dein Team.</p>
                <div className="mt-8">
                  <Input label="Dein Name" autoFocus autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Vor- und Nachname" error={error ?? undefined} />
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-auto flex gap-3 pt-10">
          {step > 0 && (
            <Button type="button" variant="secondary" size="lg" onClick={() => go(step - 1)} aria-label="Zurück">
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Button>
          )}
          <Button type="submit" size="lg" block disabled={!canNext} loading={pending}>
            {step < STEPS - 1 ? "Weiter" : "Firma anlegen"}
          </Button>
        </div>
      </form>
    </div>
  );
}
