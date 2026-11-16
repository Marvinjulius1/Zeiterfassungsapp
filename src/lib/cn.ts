import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-Klassen zusammenführen, Konflikte auflösen. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
