"use client";

import { useEffect, useState } from "react";

/** Aktuelle Zeit, sekundengenau getaktet (auf die volle Sekunde ausgerichtet). */
export function useNow(active = true): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    let timer: number;
    const tick = () => {
      setNow(new Date());
      timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [active]);
  return now;
}
