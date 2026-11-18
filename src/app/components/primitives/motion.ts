import { useEffect, useState } from "react";

/** How long every confirmation holds its check before the icon returns
 * (ElevenLabs PROMPT.md section 7.3, judgement call 18). */
export const CONFIRM_MS = 1500;

/** A busy control keeps its icon this long before it shows a spinner, so
 * quick work goes straight to its result (judgement call 19). */
export const BUSY_DELAY_MS = 400;

export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Direct feedback (a press, a check, an icon swap) plays only when the
 * pointer caused it: inputModality.ts marks the root, and the keyboard and
 * reduced motion land the end state at once (PROMPT.md section 7). */
export const pointerLed = (): boolean =>
  typeof document !== "undefined" &&
  document.documentElement.dataset.input === "pointer" &&
  !prefersReducedMotion();

/** A motion token's duration in ms, read from the element's computed style
 * (0 under reduced motion, where tokens.css sets every duration to 0). */
export function motionMs(el: Element | null, token: string): number {
  if (!el || typeof getComputedStyle !== "function") return 0;
  const raw = getComputedStyle(el).getPropertyValue(token).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return 0;
  return raw.endsWith("ms") ? n : raw.endsWith("s") ? n * 1000 : n;
}

/** True once `on` has held for `delay` ms; false again as soon as it turns
 * off. A busy control's spinner and a slow upload's pulse wait on it. */
export function useDelayedFlag(on: boolean, delay = BUSY_DELAY_MS): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!on) {
      setLate(false);
      return;
    }
    const id = window.setTimeout(() => setLate(true), delay);
    return () => window.clearTimeout(id);
  }, [on, delay]);
  return on && late;
}
