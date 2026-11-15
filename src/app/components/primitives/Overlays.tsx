import React, { useCallback, useEffect, useRef, useState } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Button } from "./Button";
import { cx } from "./cx";

/** How long the pointer or keyboard focus rests before a hint shows. */
const OPEN_DELAY_MS = 300;

// ── Input modality ────────────────────────────────────────────────────────
// A hint opens on focus only when the member moved focus with Tab. Focus a
// script hands back (a menu closing returns focus to its button, after an
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
  /** The bubble's text: a hint ("Attach") or a point ("Tue, Sep 8"). */
  label: React.ReactNode;
  /** A reading after the label ("56 exports"). */
  value?: React.ReactNode;
  /** With one element, the tooltip is a hint on that control: it takes a
   * ref and pointer and focus handlers. Without a child the tooltip is only
   * the bubble, for something that places it itself (a chart). */
  children?: React.ReactElement;
  /** Which side of the control the hint sits on. "top-start" is Top aligned
   * to the control's start edge. */
  placement?: "top-start" | "top" | "bottom" | "right" | "left";
  /** Distance from the control to the hint. */
  gap?: number;
  /** Keeps the hint shut (the plus while its menu is open). Turning it on
   * also closes a hint that is showing. */
  suppressed?: boolean;
  className?: string;
}

function BubbleContent({ label, value }: Pick<TooltipProps, "label" | "value">) {
  return (
    <>
      <span className="t-caption-m ui-tooltip__label">{label}</span>
      {value !== undefined && <span className="t-label-xs ui-tooltip__value">{value}</span>}
    </>
  );
}

/** A hint on a control, on Radix Tooltip with `open` held here, so the
 * rules are this component's:
 *
 *  - opens 300ms after the pointer enters, or after focus that came from
 *    the Tab key (never from a click, a script, or a menu handing focus
 *    back);
 *  - closes on pointer leave, blur, Escape, and when `suppressed` turns on;
 *  - no enter or exit motion.
 *
 * Radix gives the bubble role="tooltip" and points the control's
 * aria-describedby at it while it shows. */
function Hint({
  label,
  value,
  children,
  placement = "top",
  gap = 4,
  suppressed = false,
  className,
}: TooltipProps & { children: React.ReactElement }) {
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
            className={cx("ui-tooltip ui-tooltip--hint", className)}
            side={side}
            align={align}
            sideOffset={gap}
            avoidCollisions
            collisionPadding={8}
          >
            <BubbleContent label={label} value={value} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

/** Tooltip (Figma 2213:206): a small raised bubble, the label in Caption/M
 * on text/secondary and an optional value in Label/XS. Around a control it
 * is that control's hint. On its own it is the bubble alone, which a chart
 * places over the point it reads out. */
export function Tooltip(props: TooltipProps) {
  if (props.children) return <Hint {...props}>{props.children}</Hint>;
  return (
    <div className={cx("ui-tooltip", props.className)} role="tooltip">
      <BubbleContent label={props.label} value={props.value} />
    </div>
  );
}

export interface ToastProps {
  message: React.ReactNode;
  /** The optional action ("Undo"). */
  actionLabel?: string;
  onAction?(): void;
  className?: string;
}

/** Toast (Figma 2213:213): a confirmation in Body/M with an optional action,
 * a ghost Small button. A polite status, so it is read out without taking
 * focus. */
export function Toast({ message, actionLabel, onAction, className }: ToastProps) {
  return (
    <div
      className={cx("ui-toast", className)}
      role="status"
      data-action={actionLabel ? "" : undefined}
    >
      <span className="t-body-m ui-toast__message">{message}</span>
      {actionLabel && (
        <Button kind="ghost" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
