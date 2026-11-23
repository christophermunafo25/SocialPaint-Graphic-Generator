import React, { useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion, ROLL_IN, ROLL_OUT, ROLL_PX } from "./motion";

/** The number a string reads as, for the roll's direction: "1,128" is
 * 1128. Anything without digits reads as 0. */
const numberOf = (text: string): number => {
  const n = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const canAnimate = (): boolean =>
  typeof HTMLElement !== "undefined" &&
  typeof HTMLElement.prototype.animate === "function" &&
  !prefersReducedMotion();

interface RollState {
  /** The text on screen. */
  shown: string;
  /** The text it is rolling from, while a roll plays. */
  from: string | null;
  /** 1 when the number rose (digits leave upward), -1 when it fell. */
  dir: 1 | -1;
  /** Bumped on every change, so a slot that changes again restarts. */
  id: number;
}

/** A number whose changed digits roll (ElevenLabs PROMPT.md section 7.7):
 * the old digit leaves 18 up (down when the number fell) and fades, then
 * the new one arrives from the other side with useRoll's overshoot.
 * Digits and separators that did not change hold still on tabular
 * numerals; a digit that appears rolls in from blank and one that goes
 * rolls out to blank. It rolls only while `roll` is set, so a first load
 * or a background refresh swaps at once, as does reduced motion. Screen
 * readers read the whole number once; the digits are hidden from them. */
export function RollDigits({ text, roll }: { text: string; roll: boolean }) {
  const [state, setState] = useState<RollState>({ shown: text, from: null, dir: 1, id: 0 });
  if (state.shown !== text) {
    const animate = roll && canAnimate();
    setState({
      shown: text,
      from: animate ? state.shown : null,
      dir: numberOf(text) >= numberOf(state.shown) ? 1 : -1,
      id: state.id + 1,
    });
  }

  const rootRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || state.from === null) return;
    const travel = state.dir * ROLL_PX;
    const outs = Array.from(root.querySelectorAll<HTMLElement>("[data-roll-out]")).map((el) =>
      el.animate(
        [
          { transform: "translateY(0)", opacity: 1 },
          { transform: `translateY(${-travel}px)`, opacity: 0 },
        ],
        { ...ROLL_OUT, fill: "forwards" },
      ),
    );
    // The new digit arrives as the old one leaves: it waits out the out
    // half hidden, then overshoots in.
    const ins = Array.from(root.querySelectorAll<HTMLElement>("[data-roll-in]")).map((el) =>
      el.animate(
        [
          { transform: `translateY(${travel}px)`, opacity: 0 },
          { transform: "translateY(0)", opacity: 1 },
        ],
        { ...ROLL_IN, delay: ROLL_OUT.duration, fill: "backwards" },
      ),
    );
    let live = true;
    const id = state.id;
    Promise.all([...outs, ...ins].map((a) => a.finished)).then(
      () => {
        if (live) setState((s) => (s.id === id ? { ...s, from: null } : s));
      },
      () => {}, // cancelled by a newer change, which takes over
    );
    return () => {
      live = false;
    };
  }, [state.id, state.from, state.dir]);

  const { shown, from } = state;
  const width = Math.max(shown.length, from?.length ?? 0);
  // Aligned from the right, so the ones stay over the ones.
  const at = (s: string, i: number) => s[s.length - width + i] ?? "";
  const slots: React.ReactNode[] = [];
  for (let i = 0; i < width; i++) {
    const next = at(shown, i);
    const prev = from === null ? next : at(from, i);
    const place = width - i; // position from the right: a stable key
    if (prev === next) {
      slots.push(
        <span key={place} className="ui-roll__ch">
          {next}
        </span>,
      );
    } else {
      slots.push(
        <span key={`${place}-${state.id}`} className="ui-roll__slot">
          {prev && <span data-roll-out>{prev}</span>}
          {next && <span data-roll-in>{next}</span>}
        </span>,
      );
    }
  }

  return (
    <span className="ui-roll">
      <span className="sr-only">{shown}</span>
      <span ref={rootRef} className="ui-roll__digits" aria-hidden>
        {slots}
      </span>
    </span>
  );
}
