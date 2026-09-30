import React, { useCallback, useEffect, useRef, useState } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

/** How long the pointer or keyboard focus rests before the bubble shows. */
const OPEN_DELAY_MS = 300;
/** The caret (Figma sp-tooltip 558:958): 5 deep, 10 across. */
const CARET_DEPTH = 5;
const CARET_WIDTH = 10;

// ── Input modality ────────────────────────────────────────────────────────
// A tooltip opens on focus only when the member moved focus with Tab. Focus
// a script hands back (a menu closing returns focus to its button, after an
// Enter or an Escape) or focus from a click must not open it. One listener
// pair for the whole app, installed on first use.
let lastInput: "tab" | "other" = "other";
let listening = false;
function trackModality(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener(
    "keydown",
    (e) => {
      lastInput = e.key === "Tab" ? "tab" : "other";
    },
    true,
  );
  window.addEventListener(
    "pointerdown",
    () => {
      lastInput = "other";
    },
    true,
  );
}

export interface TooltipProps {
  /** The bubble's text. */
  content: string;
  /** Which side of the trigger the bubble sits on. The caret points back at
   * the trigger. "top-start" is Top aligned to the trigger's start edge. */
  placement?: "top-start" | "top" | "bottom" | "right" | "left";
  /** Distance from the trigger to the caret's tip. */
  gap?: number;
  /** Keeps the bubble shut (the plus while its menu is open). Turning it on
   * also closes a bubble that is showing. */
  suppressed?: boolean;
  /** One element that takes a ref and pointer and focus handlers. */
  children: React.ReactElement;
}

/** A small inverse bubble beside a control (Figma sp-tooltip 558:958):
 * 12/125% Medium on --gen-inverse at the 8 radius, 7/10 padding, the soft
 * --shadow-rest, a 5 × 10 caret flush against it. Built on Radix Tooltip
 * with `open` held here, so the rules are this component's:
 *
 *  - opens 300ms after the pointer enters, or after focus that came from
 *    the Tab key (never from a click, a script, or a menu handing focus
 *    back);
 *  - closes on pointer leave, blur, Escape, and when `suppressed` turns on;
 *  - no enter or exit motion; it sits on --z-tooltip.
 *
 * Radix gives the bubble role="tooltip" and points the trigger's
 * aria-describedby at it while it shows. */
export function Tooltip({
  content,
  placement = "top",
  gap = 4,
  suppressed = false,
  children,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(trackModality, []);

  const cancel = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const hide = useCallback(() => {
    cancel();
    setOpen(false);
  }, [cancel]);
  const showSoon = useCallback(() => {
    if (suppressed) return;
    cancel();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setOpen(true);
    }, OPEN_DELAY_MS);
  }, [cancel, suppressed]);

  useEffect(() => {
    if (suppressed) hide();
  }, [suppressed, hide]);
  useEffect(() => cancel, [cancel]);

  // Escape closes it from anywhere while it shows, without stopping the
  // key: a menu or panel behind may want it too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, hide]);

  const child = children as React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  const own = child.props;
  const trigger = React.cloneElement(child, {
    onPointerEnter: (e: React.PointerEvent<HTMLElement>) => {
      own.onPointerEnter?.(e);
      if (e.pointerType !== "touch") showSoon();
    },
    onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
      own.onPointerLeave?.(e);
      hide();
    },
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      own.onPointerDown?.(e);
      hide();
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      own.onFocus?.(e);
      if (lastInput === "tab") showSoon();
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      own.onBlur?.(e);
      hide();
    },
  });

  const [side, align] =
    placement === "top-start" ? (["top", "start"] as const) : ([placement, "center"] as const);

  return (
    <TooltipPrimitive.Provider delayDuration={0} disableHoverableContent>
      {/* Radix's own open requests are ignored: `open` is decided above. */}
      <TooltipPrimitive.Root open={open && !suppressed} onOpenChange={() => {}}>
        <TooltipPrimitive.Trigger asChild>{trigger}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className="sp-tooltip"
            side={side}
            align={align}
            sideOffset={gap + CARET_DEPTH}
            avoidCollisions
            collisionPadding={8}
          >
            {content}
            <TooltipPrimitive.Arrow
              className="sp-tooltip__caret"
              width={CARET_WIDTH}
              height={CARET_DEPTH}
            />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
