import { useEffect, useState } from "react";

/** The design system's motion tokens, read from the cascade so `motion`
 * animates on exactly the durations and easing every CSS transition uses —
 * --dur-state / --dur-panel / --dur-reveal and --ease — and collapses to a
 * plain swap under prefers-reduced-motion, where the tokens themselves are
 * already 0ms. One source of timing; nothing hand-rolled. Durations are in
 * seconds, as `motion` expects. */
export interface MotionTokens {
  state: number;
  panel: number;
  reveal: number;
  ease: [number, number, number, number];
}

const FALLBACK: MotionTokens = { state: 0.14, panel: 0.22, reveal: 0.4, ease: [0.2, 0, 0, 1] };

const seconds = (raw: string, fallback: number) => {
  const v = raw.trim();
  if (v.endsWith("ms")) return parseFloat(v) / 1000;
  if (v.endsWith("s")) return parseFloat(v);
  return v === "" ? fallback : Number(v) || 0;
};

function readTokens(): MotionTokens {
  if (typeof window === "undefined" || typeof getComputedStyle !== "function") return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const bezier = /cubic-bezier\(([^)]+)\)/.exec(cs.getPropertyValue("--ease"));
  const ease = bezier
    ? (bezier[1].split(",").map((n) => parseFloat(n)) as MotionTokens["ease"])
    : FALLBACK.ease;
  return {
    state: seconds(cs.getPropertyValue("--dur-state"), FALLBACK.state),
    panel: seconds(cs.getPropertyValue("--dur-panel"), FALLBACK.panel),
    reveal: seconds(cs.getPropertyValue("--dur-reveal"), FALLBACK.reveal),
    ease: ease.length === 4 ? ease : FALLBACK.ease,
  };
}

/** Motion tokens for the current document, re-read when the reduced-motion
 * preference flips so an open screen follows the setting without a reload. */
export function useMotionTokens(): MotionTokens {
  const [tokens, setTokens] = useState<MotionTokens>(readTokens);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setTokens(readTokens());
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return tokens;
}
