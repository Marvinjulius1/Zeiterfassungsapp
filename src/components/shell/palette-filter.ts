/**
 * Präzise statt unscharf: Wortanfang > Teilstring > nichts.
 * (cmdks Standard findet „noah" auch verstreut in „Gehe zu Audit-Log".)
 */
export function paletteFilter(value: string, search: string, keywords?: string[]): number {
  const term = search.trim().toLowerCase();
  if (!term) return 1;
  const hay = [value, ...(keywords ?? [])].join(" ").toLowerCase();
  if (hay.split(/[\s-]+/).some((w) => w.startsWith(term))) return 1;
  return hay.includes(term) ? 0.5 : 0;
}
