"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { Check, X } from "lucide-react";
import { Avatar } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";
import { toast } from "@/design-system/components/toaster";
import { spring } from "@/design-system/motion";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { reviewAbsence, reviewCorrection } from "../actions";
import type { InboxItem } from "../queries";

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

export function Inbox({ initial }: { initial: InboxItem[] }) {
  const [items, setItems] = useState(initial);
  const [activeRaw, setActive] = useState(0);
  const active = Math.max(0, Math.min(activeRaw, items.length - 1));
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [, start] = useTransition();

  const decide = useCallback(
    (item: InboxItem, approve: boolean, reason?: string) => {
      haptic(approve ? "success" : "medium");
      setItems((list) => list.filter((x) => x.id !== item.id));
      setRejecting(null);
      setNote("");
      start(async () => {
        const fn = item.type === "correction" ? reviewCorrection : reviewAbsence;
        const res = await fn(item.id, approve, reason);
        if (!res.ok) {
          toast.error(res.error);
          setItems((list) => [...list, item].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
          return;
        }
        toast.success(`${item.title} von ${item.name.split(" ")[0]} ${approve ? "genehmigt" : "abgelehnt"}`);
      });
    },
    [],
  );

  // Tastatur: J/K bzw. ↓/↑ wechseln, A genehmigen, R ablehnen, Esc abbrechen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const item = items[active];
      if (!item) return;
      const k = e.key.toLowerCase();
      if (k === "j" || e.key === "ArrowDown") setActive((i) => Math.min(i + 1, items.length - 1));
      else if (k === "k" || e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
      else if (k === "a") decide(item, true);
      else if (k === "r") setRejecting(item.id);
      else if (e.key === "Escape") setRejecting(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, active, decide]);

  if (items.length === 0) {
    return (
      <EmptyState
        title="Alles erledigt ✓"
        description="Keine offenen Anträge. Neue Korrekturen und Urlaubsanträge landen automatisch hier."
        illustration={
          <motion.span
            initial={{ scale: 0.4, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 14 }}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-ok"
          >
            <Check className="h-10 w-10 text-bg" strokeWidth={3} aria-hidden />
          </motion.span>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="hidden text-sm text-fg-3 lg:block">
        Tastatur: <Kbd>J</Kbd>/<Kbd>K</Kbd> wechseln · <Kbd>A</Kbd> genehmigen · <Kbd>R</Kbd> ablehnen
      </p>
      <p className="text-sm text-fg-3 lg:hidden">Tipp: nach rechts wischen = genehmigen, nach links = ablehnen.</p>
      <ul className="space-y-3" aria-label="Offene Anträge">
        <AnimatePresence initial={false}>
          {items.map((item, i) => (
            <InboxCard
              key={item.id}
              item={item}
              active={i === active}
              onFocus={() => setActive(i)}
              onApprove={() => decide(item, true)}
              onReject={() => setRejecting(item.id)}
              rejecting={rejecting === item.id}
              note={note}
              setNote={setNote}
              onConfirmReject={() => decide(item, false, note)}
              onCancelReject={() => setRejecting(null)}
            />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="mx-0.5 rounded-md border border-line-strong bg-surface-2 px-1.5 py-0.5 font-sans text-xs text-fg-2">{children}</kbd>;
}

function InboxCard({
  item, active, onFocus, onApprove, onReject, rejecting, note, setNote, onConfirmReject, onCancelReject,
}: {
  item: InboxItem;
  active: boolean;
  onFocus: () => void;
  onApprove: () => void;
  onReject: () => void;
  rejecting: boolean;
  note: string;
  setNote: (v: string) => void;
  onConfirmReject: () => void;
  onCancelReject: () => void;
}) {
  const x = useMotionValue(0);
  const approveOpacity = useTransform(x, [20, 120], [0, 1]);
  const rejectOpacity = useTransform(x, [-120, -20], [1, 0]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 120) onApprove();
    else if (info.offset.x < -120) onReject();
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 0, height: 0, marginTop: 0 }}
      transition={spring.gentle}
      className="relative"
    >
      {/* Wisch-Hintergrund */}
      <div className="absolute inset-0 flex items-center justify-between rounded-[24px] px-6" aria-hidden>
        <motion.span style={{ opacity: approveOpacity }} className="flex items-center gap-2 font-semibold text-ok">
          <Check className="h-5 w-5" /> Genehmigen
        </motion.span>
        <motion.span style={{ opacity: rejectOpacity }} className="flex items-center gap-2 font-semibold text-alert">
          Ablehnen <X className="h-5 w-5" />
        </motion.span>
      </div>
      <motion.div
        drag={rejecting ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={onDragEnd}
        style={{ x }}
        onClick={onFocus}
        className={cn(
          "relative cursor-grab rounded-[24px] border bg-surface p-5 transition-colors active:cursor-grabbing",
          active ? "border-line-strong" : "border-line",
        )}
      >
        <div className="flex items-start gap-4">
          <Avatar name={item.name} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-semibold">{item.name}</p>
              <Badge tone={item.type === "absence" ? "neutral" : "pause"}>{item.title}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-fg-2">{item.subtitle}</p>
            <dl className="mt-3 space-y-1 text-sm">
              {item.details.map((d) => (
                <div key={d.label} className="flex gap-3">
                  <dt className="w-14 shrink-0 text-fg-3">{d.label}</dt>
                  <dd className="tabular text-fg">{d.value}</dd>
                </div>
              ))}
            </dl>
            {item.reason && <p className="mt-3 rounded-[14px] bg-surface-2 px-3 py-2 text-sm text-fg-2">„{item.reason}“</p>}
          </div>
          <div className="hidden shrink-0 gap-2 sm:flex">
            <Button variant="secondary" size="icon" aria-label={`${item.title} von ${item.name} ablehnen`} onClick={onReject}>
              <X className="h-5 w-5" aria-hidden />
            </Button>
            <Button size="icon" aria-label={`${item.title} von ${item.name} genehmigen`} onClick={onApprove}>
              <Check className="h-5 w-5" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="mt-4 flex gap-2 sm:hidden">
          <Button variant="secondary" block onClick={onReject}>Ablehnen</Button>
          <Button block onClick={onApprove}>Genehmigen</Button>
        </div>

        <AnimatePresence>
          {rejecting && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.gentle}
              className="overflow-hidden"
              onSubmit={(e) => {
                e.preventDefault();
                onConfirmReject();
              }}
            >
              <div className="flex gap-2 pt-4">
                <input
                  autoFocus
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && onCancelReject()}
                  placeholder="Kurze Begründung (optional)"
                  aria-label="Begründung für die Ablehnung"
                  className="h-11 flex-1 rounded-full border border-line bg-surface-2 px-4 text-sm text-fg outline-none focus:border-line-strong"
                />
                <Button type="submit" variant="danger">Ablehnen</Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.li>
  );
}
