import { z } from "zod";

/**
 * Firmenregeln. Jede Ebene (Firma → Standort → Person) speichert nur, was sie
 * überschreibt; `resolveRules()` führt alles mit den Standardwerten zusammen.
 */

const enforcement = z.enum(["off", "warn", "block"]);
export type Enforcement = z.infer<typeof enforcement>;

export const STAMP_METHODS = ["app", "terminal_qr", "personal_qr", "pin", "rfid", "nfc"] as const;
export type StampMethod = (typeof STAMP_METHODS)[number];

export const ruleSettingsSchema = z.object({
  checkIn: z.object({
    /** Frühestens x Minuten vor Schichtbeginn einchecken */
    earliestBeforeShiftMin: z.number().int().min(0).max(240),
    earliestEnforcement: enforcement,
    /** Toleranz bei Verspätung in Minuten */
    lateToleranceMin: z.number().int().min(0).max(120),
    notifyLeadOnLate: z.boolean(),
  }),
  checkOut: z.object({
    /** Spätestens x Minuten nach Schichtende auschecken (sonst Hinweis) */
    latestAfterShiftMin: z.number().int().min(0).max(480),
    latestEnforcement: z.enum(["off", "warn"]),
  }),
  rounding: z.object({
    mode: z.enum(["none", "employee_favor", "commercial"]),
    unitMin: z.union([z.literal(5), z.literal(10), z.literal(15)]),
  }),
  autoBreak: z.object({
    /** Fehlende gesetzliche Pause automatisch von der bewerteten Zeit abziehen */
    enabled: z.boolean(),
  }),
  autoCheckout: z.object({
    enabled: z.boolean(),
    afterHours: z.number().min(4).max(16),
    atMidnight: z.boolean(),
  }),
  methods: z.object({
    allowed: z.array(z.enum(STAMP_METHODS)).min(1),
    requireGeofence: z.boolean(),
  }),
  corrections: z.object({
    /** Dürfen Mitarbeiter selbst korrigieren (wird protokolliert) oder nur mit Freigabe? */
    mode: z.enum(["approval", "self"]),
  }),
  overtime: z.object({
    /** Freigabe nötig ab x Minuten Mehrarbeit pro Tag (0 = aus) */
    approvalAboveMin: z.number().int().min(0).max(600),
    /** Kappungsgrenze des Stundenkontos in Minuten (0 = keine) */
    balanceCapMin: z.number().int().min(0).max(30000),
  }),
  surcharges: z.object({
    nightPct: z.number().min(0).max(100),
    /** Nachtzeit nach § 2 Abs. 3 ArbZG: 23–6 Uhr (einstellbar) */
    nightFromHour: z.number().int().min(18).max(24),
    nightToHour: z.number().int().min(0).max(8),
    sundayPct: z.number().min(0).max(100),
    holidayPct: z.number().min(0).max(200),
  }),
  enforcement: z.object({
    restPeriod: enforcement,
    dailyMax: enforcement,
    minorsNightRest: enforcement,
  }),
  /** Vertrauensarbeitszeit: erfassen ja, aber keine Kontrolle von Beginn/Ende */
  trustBasedHours: z.boolean(),
  /** MiLoG-Aufzeichnungsfrist für alle prüfen, nicht nur für Minijobs */
  milogAllEmployees: z.boolean(),
});

export type RuleSettings = z.infer<typeof ruleSettingsSchema>;

export const DEFAULT_RULES: RuleSettings = {
  checkIn: { earliestBeforeShiftMin: 15, earliestEnforcement: "off", lateToleranceMin: 5, notifyLeadOnLate: false },
  checkOut: { latestAfterShiftMin: 60, latestEnforcement: "off" },
  rounding: { mode: "none", unitMin: 5 },
  autoBreak: { enabled: false },
  autoCheckout: { enabled: true, afterHours: 12, atMidnight: false },
  methods: { allowed: ["app", "terminal_qr", "personal_qr", "pin", "rfid", "nfc"], requireGeofence: false },
  corrections: { mode: "approval" },
  overtime: { approvalAboveMin: 0, balanceCapMin: 0 },
  surcharges: { nightPct: 0, nightFromHour: 23, nightToHour: 6, sundayPct: 0, holidayPct: 0 },
  enforcement: { restPeriod: "warn", dailyMax: "warn", minorsNightRest: "block" },
  trustBasedHours: false,
  milogAllEmployees: false,
};

const S = ruleSettingsSchema.shape;

/** Teil-Überschreibung einer Ebene (Firma, Standort oder Person) */
export const ruleOverrideSchema = z
  .object({
    checkIn: S.checkIn.partial().optional(),
    checkOut: S.checkOut.partial().optional(),
    rounding: S.rounding.partial().optional(),
    autoBreak: S.autoBreak.partial().optional(),
    autoCheckout: S.autoCheckout.partial().optional(),
    methods: S.methods.partial().optional(),
    corrections: S.corrections.partial().optional(),
    overtime: S.overtime.partial().optional(),
    surcharges: S.surcharges.partial().optional(),
    enforcement: S.enforcement.partial().optional(),
    trustBasedHours: S.trustBasedHours.optional(),
    milogAllEmployees: S.milogAllEmployees.optional(),
  })
  .strict();

export type RuleOverride = z.infer<typeof ruleOverrideSchema>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(patch) || !isPlainObject(base)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || !(k in out)) continue; // unbekannte Schlüssel ignorieren
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

/**
 * Effektive Regeln: Standard ⊕ Firma ⊕ Standort ⊕ Person.
 * Ungültige gespeicherte Werte fallen sicher auf den Standard zurück.
 */
export function resolveRules(...layers: readonly unknown[]): RuleSettings {
  const merged = layers.reduce<RuleSettings>((acc, layer) => deepMerge(acc, layer), DEFAULT_RULES);
  const parsed = ruleSettingsSchema.safeParse(merged);
  if (parsed.success) return parsed.data;
  // Feldweise reparieren: nur gültige Abschnitte übernehmen
  const repaired: Record<string, unknown> = { ...DEFAULT_RULES };
  for (const key of Object.keys(DEFAULT_RULES) as (keyof RuleSettings)[]) {
    const ok = ruleSettingsSchema.shape[key].safeParse((merged as Record<string, unknown>)[key]);
    if (ok.success) repaired[key] = ok.data;
  }
  return repaired as RuleSettings;
}

/**
 * Nur die Abweichungen gegenüber der übergeordneten Ebene speichern – so erben
 * Standorte automatisch spätere Änderungen der Firmenregeln.
 */
export function diffRules(parent: RuleSettings, effective: RuleSettings): RuleOverride {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(effective) as (keyof RuleSettings)[]) {
    const p: unknown = parent[key];
    const e: unknown = effective[key];
    if (isPlainObject(e) && isPlainObject(p)) {
      const section: Record<string, unknown> = {};
      for (const k of Object.keys(e)) {
        if (JSON.stringify(e[k]) !== JSON.stringify(p[k])) section[k] = e[k];
      }
      if (Object.keys(section).length > 0) out[key] = section;
    } else if (JSON.stringify(e) !== JSON.stringify(p)) {
      out[key] = e;
    }
  }
  return out as RuleOverride;
}
