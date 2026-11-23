import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { IconComponent } from "./cx";
import { trackInputModality } from "./inputModality";
import { motionMs, pointerLed, useDelayedFlag } from "./motion";

/** The spinner a busy control shows once its wait passes 400 ms: a quiet
 * ring with a quarter arc that turns (PROMPT.md section 7.3). */
function SpinnerGlyph(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="5.25" opacity="0.25" />
      <path d="M8 2.75a5.25 5.25 0 0 1 5.25 5.25" />
    </svg>
  );
}

/** The check, drawn: the Checkbox's mark on the 16 box at a 1.5 stroke, on
 * pathLength 1 so the stroke can draw itself in. */
function CheckGlyph(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path pathLength={1} d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

const SPINNER = "spinner" as const;
type Shown = IconComponent | typeof SPINNER;

const nameOf = (icon: Shown): string =>
  icon === SPINNER ? SPINNER : ((icon as { displayName?: string }).displayName ?? "");
/** An arrow only fades: it never scales or moves. */
const ARROWS = new Set(["Download", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"]);

interface Layer {
  key: number;
  icon: Shown;
  leaving: boolean;
}

/** The 16 icon slot of Button and Icon Button. A change of icon crossfades
 * the two glyphs (the leaving one shrinks to 0.7, the arriving one grows
 * from it), a check draws itself in, and while `busy` has held for 400 ms
 * the slot shows the spinner. The width never changes.
 *
 * The swap is direct feedback, so it plays only when the pointer led to it:
 * from the keyboard or under reduced motion the new glyph is simply there
 * (PROMPT.md section 7.3). First paint never animates. */
export function IconSlot({ icon, busy = false }: { icon: IconComponent; busy?: boolean }) {
  const spinning = useDelayedFlag(busy);
  const shown: Shown = spinning ? SPINNER : icon;
  const slot = useRef<HTMLSpanElement>(null);
  const nextKey = useRef(1);
  const [layers, setLayers] = useState<Layer[]>([{ key: 0, icon: shown, leaving: false }]);
  const [animate, setAnimate] = useState(false);
  const last = useRef<Shown>(shown);

  useEffect(trackInputModality, []);

  // Before paint, so the old glyph never shows alone for a frame.
  useLayoutEffect(() => {
    if (shown === last.current) return;
    last.current = shown;
    const key = nextKey.current++;
    if (!pointerLed()) {
      setAnimate(false);
      setLayers([{ key, icon: shown, leaving: false }]);
      return;
    }
    setAnimate(true);
    setLayers((prev) => [
      ...prev.filter((l) => !l.leaving).map((l) => ({ ...l, leaving: true })),
      { key, icon: shown, leaving: false },
    ]);
    const done = window.setTimeout(
      () => setLayers((prev) => prev.filter((l) => !l.leaving)),
      motionMs(slot.current, "--motion-duration-base") + 40,
    );
    return () => window.clearTimeout(done);
  }, [shown]);

  return (
    <span ref={slot} className="ui-icon-slot" data-animate={animate || undefined} aria-hidden>
      {layers.map((layer) => {
        const name = nameOf(layer.icon);
        const common = {
          "data-leaving": layer.leaving || undefined,
          "data-arrow": ARROWS.has(name) || undefined,
        };
        if (layer.icon === SPINNER)
          return (
            <span key={layer.key} className="ui-icon-slot__g" {...common}>
              <SpinnerGlyph className="ui-icon ui-icon-slot__spinner" />
            </span>
          );
        if (name === "Check")
          return (
            <span key={layer.key} className="ui-icon-slot__g ui-icon-slot__check" {...common}>
              <CheckGlyph className="ui-icon" />
            </span>
          );
        return (
          <span key={layer.key} className="ui-icon-slot__g" {...common}>
            {React.createElement(layer.icon, {
              size: 16,
              className: "ui-icon",
              "aria-hidden": true,
            })}
          </span>
        );
      })}
    </span>
  );
}
