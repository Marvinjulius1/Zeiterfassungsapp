/** Alter an einem Stichtag (yyyy-MM-dd). */
export function ageOn(birthDate: string, dateKey: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = dateKey.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

/** Jugendliche im Sinne des JArbSchG: unter 18. */
export function isMinorOn(birthDate: string | null | undefined, dateKey: string): boolean {
  return birthDate ? ageOn(birthDate, dateKey) < 18 : false;
}
