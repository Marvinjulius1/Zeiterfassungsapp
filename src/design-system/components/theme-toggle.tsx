"use client";

import { useSyncExternalStore } from "react";
import { Segmented } from "./segmented";

export type Theme = "dark" | "light";
const COOKIE = "zg_theme";

function read(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.cookie = `${COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "dark" ? "#000000" : "#ffffff");
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => "dark");
}

/** Inline-Skript für <head>: setzt das Theme vor dem ersten Paint. */
export const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${COOKIE}=(dark|light)/);if(m)document.documentElement.setAttribute("data-theme",m[1])}catch(e){}})()`;

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  return (
    <Segmented
      className={className}
      label="Darstellung"
      value={theme}
      onChange={setTheme}
      options={[
        { value: "dark", label: "Dunkel" },
        { value: "light", label: "Hell" },
      ]}
    />
  );
}

