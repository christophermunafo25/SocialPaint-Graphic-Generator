import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Minus, Plus } from "lucide-react";
import { MAX_VARIATIONS, MIN_VARIATIONS, clampVariations } from "@/lib/generate/chatReducer";

/** The roll (PROMPT §7.7): the old number leaves in the direction of the
 * step, the new one arrives from the other side and settles with a small
 * overshoot. Distance and timings are the spec's. */
const ROLL_PX = 18;
const OUT = { duration: 130, easing: "ease-in" } as const;
const IN = { duration: 190, easing: "cubic-bezier(0.3, 1.5, 0.5, 1)" } as const;

/** The Figma draws the minus and plus inside a 16px icon box at 80% of the
 * box (lucide's geometry at 12.8px), stroked at 1.2. */
const GLYPH = 12.8;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Stop any half of the roll still running on the number. */
const cancelRoll = (el: HTMLElement) => {
  if (typeof el.getAnimations === "function") el.getAnimations().forEach((a) => a.cancel());
};

/** How many drafts a send asks for (Figma "Generate · Chat", sp-stepper
 * 302:324, States Min / Mid / Max): a 36px tile holding the "Variations"
 * label, a Decrease button, the value and an Increase button. The range is
 * the server's `count` range, MIN_VARIATIONS to MAX_VARIATIONS (1 to 3); the
 * Figma's Max sample of 4 is only a sample.
 *
 * The value rolls in the direction you stepped (Web Animations API on the
 * number, so no state machine in CSS), and swaps with no motion under
 * prefers-reduced-motion or where `animate` is missing. It is a polite live
 * region, so the new count is read out after either kind of swap.
 *
 * A bound button stays focusable (aria-disabled, not disabled): stepping to
 * the end of the range must not drop keyboard focus onto the page. */
export function VariationsStepper({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange(next: number): void;
  disabled?: boolean;
}) {
  const labelId = useId();
  const numRef = useRef<HTMLSpanElement>(null);
  // What the number element shows. It trails `value` by the out half of the
  // roll, so the text swaps while the old number is out of sight.
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  // Direction of the in half still to play once `shown` has swapped:
  // 1 stepped up, -1 stepped down, 0 nothing pending.
  const pendingIn = useRef<0 | 1 | -1>(0);

  useEffect(() => {
    const from = shownRef.current;
    const el = numRef.current;
    if (value === from) {
      // Stepped back before the old number had left: put it back at rest.
      if (el) cancelRoll(el);
      return;
    }
    const swap = (dir: 0 | 1 | -1) => {
      pendingIn.current = dir;
      shownRef.current = value;
      setShown(value);
    };
    if (!el || typeof el.animate !== "function" || prefersReducedMotion()) {
      swap(0);
      return;
    }
    // Stepping up moves the old number up and out.
    const dir = value > from ? 1 : -1;
    cancelRoll(el);
    const out = el.animate(
      [
        { transform: "translateY(0)", opacity: 1 },
        { transform: `translateY(${-dir * ROLL_PX}px)`, opacity: 0 },
      ],
      { ...OUT, fill: "forwards" },
    );
    let live = true;
    out.finished.then(
      () => {
        // Commit the new text now, in this callback. Left to a normal
        // (batched) render, a click landing before that render would read
        // the advanced shownRef while the old number is still on screen,
        // and the late commit would then cancel that click's roll: the
        // count and the display would disagree for good.
        if (live) flushSync(() => swap(dir));
      },
      () => {}, // cancelled by a newer step, which takes over from here
    );
    return () => {
      live = false;
    };
  }, [value]);

  // The in half runs after the new text is committed, before paint, so the
  // swapped number never flashes at rest between the two halves.
  useLayoutEffect(() => {
    const dir = pendingIn.current;
    const el = numRef.current;
    if (!dir || !el) return;
    pendingIn.current = 0;
    cancelRoll(el); // drops the out half's held end state
    el.animate(
      [
        { transform: `translateY(${dir * ROLL_PX}px)`, opacity: 0 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      IN,
    );
  }, [shown]);

  const atMin = value <= MIN_VARIATIONS;
  const atMax = value >= MAX_VARIATIONS;
  const step = (delta: 1 | -1) => {
    if (disabled || (delta < 0 ? atMin : atMax)) return;
    onChange(clampVariations(value + delta));
  };

  return (
    <div
      className="sp-chat-stepper"
      role="group"
      aria-labelledby={labelId}
      data-disabled={disabled || undefined}
    >
      <span id={labelId} className="sp-chat-stepper__label">
        Variations
      </span>
      <div className="sp-chat-stepper__controls">
        <button
          type="button"
          className="sp-chat-stepper__btn"
          aria-label="Fewer variations"
          aria-disabled={atMin || undefined}
          disabled={disabled}
          onClick={() => step(-1)}
        >
          <Minus size={GLYPH} strokeWidth={1.2} absoluteStrokeWidth aria-hidden />
        </button>
        <span className="sp-chat-stepper__value">
          <span ref={numRef} className="sp-chat-stepper__num" aria-live="polite">
            {shown}
          </span>
        </span>
        <button
          type="button"
          className="sp-chat-stepper__btn"
          aria-label="More variations"
          aria-disabled={atMax || undefined}
          disabled={disabled}
          onClick={() => step(1)}
        >
          <Plus size={GLYPH} strokeWidth={1.2} absoluteStrokeWidth aria-hidden />
        </button>
      </div>
    </div>
  );
}
