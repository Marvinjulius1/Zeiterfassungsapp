export const CORRECTION_KIND_LABEL: Record<string, string> = {
  missing_check_in: "Einstempeln vergessen",
  missing_check_out: "Ausstempeln vergessen",
  wrong_time: "Falsche Zeit",
  missing_break: "Pause nachtragen",
  other: "Sonstiges",
};

export const STATUS_LABEL: Record<string, { label: string; tone: "neutral" | "ok" | "pause" | "alert" }> = {
  pending: { label: "Offen", tone: "pause" },
  approved: { label: "Genehmigt", tone: "ok" },
  rejected: { label: "Abgelehnt", tone: "alert" },
  cancelled: { label: "Zurückgezogen", tone: "neutral" },
};
