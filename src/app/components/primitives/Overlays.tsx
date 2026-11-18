import React, { useCallback, useEffect, useRef, useState } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Button } from "./Button";
import { cx } from "./cx";
import { motionMs } from "./motion";

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
  /** Showing (the default). Turned off, it eases out and then unmounts; a
   * new message while it leaves turns it back. */
  open?: boolean;
  /** How long it shows, in ms, before `onTimeout`. The time waits while the
   * pointer or focus is on the toast and while the tab is hidden. */
  duration?: number;
  /** Time ran out: the owner closes it (sets `open` false). */
  onTimeout?(): void;
  /** Restarts the time when it changes, for a new message that reads the
   * same as the last ("Color changed" twice). */
  messageKey?: unknown;
  className?: string;
}

/** Toast (Figma 2213:213): a confirmation in Body/M with an optional action,
 * a ghost Small button. A polite status, so it is read out without taking
 * focus.
 *
 * It eases in from 8 below as it mounts and eases back out when it closes
 * (PROMPT.md section 7.2). Given a `duration` it owns its timer, which
 * waits while the pointer or focus is on it or the tab is hidden, so its
 * Undo never runs out under the pointer (WCAG 2.2.1). */
export function Toast({
  message,
  actionLabel,
  onAction,
  open = true,
  duration,
  onTimeout,
  messageKey,
  className,
}: ToastProps) {
  const el = useRef<HTMLDivElement>(null);
  // While it leaves it keeps showing what it last said.
  const shown = useRef({ message, actionLabel, onAction });
  if (open) shown.current = { message, actionLabel, onAction };
  const [mounted, setMounted] = useState(open);
  const leaving = mounted && !open;
  // Focus that came from the page before it, for the way back.
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const node = el.current;
    if (node && node.contains(document.activeElement)) {
      const back = returnFocus.current;
      if (back && back.isConnected) back.focus();
      else (document.activeElement as HTMLElement | null)?.blur();
    }
    const id = window.setTimeout(
      () => setMounted(false),
      motionMs(node, "--motion-duration-fast") + 40,
    );
    return () => window.clearTimeout(id);
  }, [open, mounted]);

  // The timer: a fresh run each time it opens or its message changes.
  const timeout = useRef(onTimeout);
  timeout.current = onTimeout;
  const held = useRef({ pointer: false, focus: false });
  const clock = useRef({ remaining: 0, since: 0, id: undefined as number | undefined });
  const resetKey = typeof message === "string" ? message : null;

  const isHeld = () =>
    held.current.pointer || held.current.focus || document.visibilityState === "hidden";
  const stop = useCallback(() => {
    const c = clock.current;
    if (c.id === undefined) return;
    window.clearTimeout(c.id);
    c.id = undefined;
    c.remaining = Math.max(0, c.remaining - (performance.now() - c.since));
  }, []);
  const run = useCallback(() => {
    const c = clock.current;
    if (c.id !== undefined || isHeld()) return;
    c.since = performance.now();
    c.id = window.setTimeout(() => {
      c.id = undefined;
      timeout.current?.();
    }, c.remaining);
  }, []);

  useEffect(() => {
    if (!open || duration === undefined) return;
    const c = clock.current;
    if (c.id !== undefined) window.clearTimeout(c.id);
    c.id = undefined;
    c.remaining = duration;
    run();
    const onVisibility = () => (isHeld() ? stop() : run());
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (c.id !== undefined) window.clearTimeout(c.id);
      c.id = undefined;
    };
  }, [open, duration, resetKey, messageKey, run, stop]);

  const hold = (part: "pointer" | "focus", on: boolean) => {
    held.current[part] = on;
    if (!open || duration === undefined) return;
    if (isHeld()) stop();
    else run();
  };

  if (!mounted && !open) return null;
  const now = shown.current;
  return (
    <div
      ref={el}
      className={cx("ui-toast", className)}
      role="status"
      data-action={now.actionLabel ? "" : undefined}
      data-leaving={leaving || undefined}
      onPointerEnter={() => hold("pointer", true)}
      onPointerLeave={() => hold("pointer", false)}
      onFocus={(e) => {
        if (!held.current.focus && e.relatedTarget instanceof HTMLElement)
          returnFocus.current = e.relatedTarget;
        hold("focus", true);
      }}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        hold("focus", false);
      }}
    >
      <span className="t-body-m ui-toast__message">{now.message}</span>
      {now.actionLabel && (
        <Button kind="ghost" size="sm" onClick={now.onAction} tabIndex={leaving ? -1 : undefined}>
          {now.actionLabel}
        </Button>
      )}
    </div>
  );
}
