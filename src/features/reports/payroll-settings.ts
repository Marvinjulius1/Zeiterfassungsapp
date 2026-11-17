import { z } from "zod";

/**
 * DATEV-Zuordnung je Firma. Die Lohnarten-Nummern legt das Steuerbüro fest –
 * die Standardwerte sind nur Platzhalter und müssen abgestimmt werden.
 */
export const payrollSettingsSchema = z.object({
  beraterNr: z.string().regex(/^\d{0,7}$/).default(""),
  mandantNr: z.string().regex(/^\d{0,5}$/).default(""),
  lohnarten: z
    .object({
      worked: z.number().int().min(0).max(9999).default(100),
      overtime: z.number().int().min(0).max(9999).default(200),
      night: z.number().int().min(0).max(9999).default(300),
      sunday: z.number().int().min(0).max(9999).default(301),
      holiday: z.number().int().min(0).max(9999).default(302),
      vacation: z.number().int().min(0).max(9999).default(400),
      sick: z.number().int().min(0).max(9999).default(500),
    })
    .default({ worked: 100, overtime: 200, night: 300, sunday: 301, holiday: 302, vacation: 400, sick: 500 }),
});

export type PayrollSettings = z.infer<typeof payrollSettingsSchema>;

export function resolvePayrollSettings(raw: unknown): PayrollSettings {
  const parsed = payrollSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : payrollSettingsSchema.parse({});
}

export const LOHNART_LABEL: Record<keyof PayrollSettings["lohnarten"], string> = {
  worked: "Gearbeitete Stunden",
  overtime: "Überstunden (Monatssaldo > 0)",
  night: "Nachtarbeit",
  sunday: "Sonntagsarbeit",
  holiday: "Feiertagsarbeit",
  vacation: "Urlaub (Stunden)",
  sick: "Krankheit (Stunden)",
};
