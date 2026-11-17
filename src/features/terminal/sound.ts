/** Dezente Töne per Web Audio – kein Asset nötig. */
let ctx: AudioContext | null = null;

function tone(freq: number, start: number, duration: number, gain = 0.08) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + duration + 0.05);
}

export function playSound(kind: "success" | "pause" | "error") {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    if (kind === "success") {
      tone(880, 0, 0.18);
      tone(1318.5, 0.12, 0.28);
    } else if (kind === "pause") {
      tone(659.3, 0, 0.2);
      tone(523.3, 0.14, 0.3);
    } else {
      tone(220, 0, 0.25, 0.1);
      tone(196, 0.18, 0.3, 0.1);
    }
  } catch {
    /* Audio nicht verfügbar */
  }
}
