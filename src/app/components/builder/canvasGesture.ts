// The one pointer-gesture core behind every drag on the design canvas —
// element moves, resize handles, the rotate handle, and draw-to-create all
// run through startDrag. The contract, in full:
//
//  - The pointer is captured on start and released on end, cancel included,
//    so a fast drag that leaves the element — or the window — keeps working
//    and a release outside the window still ends the gesture.
//  - Movement is throttled to requestAnimationFrame: at most one onMove per
//    frame, always with the latest pointer position.
//  - A small screen-px threshold separates clicks from drags; a release
//    below it reports onTap, never a zero-distance drag commit.
//  - The gesture dies cleanly on pointercancel, lost capture, window blur,
//    Escape, a newer gesture starting, or component unmount — onCancel fires
//    and nothing commits. Escape is swallowed (capture phase) so the
//    builder's Escape-deselects-everything shortcut can't fire mid-drag.
//  - One gesture exists at a time, globally; callers commit once in onEnd,
//    which is what makes a whole drag a single undo entry.

export interface DragCallbacks {
  /** Screen-px movement required before the gesture becomes a drag; a
   * release below it is a tap. Default 3. */
  threshold?: number;
  /** The pointer crossed the threshold — the drag is live. */
  onStart?(): void;
  /** At most one call per animation frame, with the latest pointer state.
   * dx/dy are screen-px deltas from the pointer-down point; the caller owns
   * the (one-per-frame) conversion into canvas space. */
  onMove(dx: number, dy: number, ev: PointerEvent): void;
  /** Pointer released after a started drag — commit now. */
  onEnd?(): void;
  /** The gesture died without a release — discard, commit nothing. */
  onCancel?(): void;
  /** Released before the threshold — a click, not a drag. */
  onTap?(ev: PointerEvent): void;
  /** CSS cursor to force on the whole document for the gesture's lifetime.
   * Pointer capture routes the EVENTS to one element but leaves hover
   * styling alone, so without this the cursor flickers every time the
   * pointer crosses another element mid-drag. Cleared on teardown, cancel
   * included. */
  cursor?: string;
}

interface ActiveGesture {
  cancel(): void;
  started(): boolean;
}

let active: ActiveGesture | null = null;

/** True while a canvas drag is live (past its threshold). The builder's
 * global shortcuts check this so Delete/undo/paste can't fire mid-drag. */
export function canvasGestureActive(): boolean {
  return active !== null && active.started();
}

/** Kill the current gesture without committing — the overlay calls this on
 * unmount so a mode switch mid-drag can't strand a capture. */
export function cancelActiveGesture(): void {
  active?.cancel();
}

export function startDrag(
  e: { pointerId: number; clientX: number; clientY: number },
  captureEl: HTMLElement,
  cb: DragCallbacks,
): void {
  active?.cancel();

  const threshold = cb.threshold ?? 3;
  const startX = e.clientX;
  const startY = e.clientY;
  let started = false;
  let ended = false;
  let raf = 0;
  let last: PointerEvent | null = null;

  try {
    captureEl.setPointerCapture(e.pointerId);
  } catch {
    // Synthetic/secondary pointers may not be capturable; window-level mouse
    // tracking still covers the common cases.
  }

  // Set from the press, not from the threshold: the cursor must not change
  // between "pressed on a resize handle" and "resizing".
  if (cb.cursor) {
    document.body.style.setProperty("cursor", cb.cursor, "important");
    document.body.setAttribute("data-sp-gesture", "");
  }

  const flush = () => {
    raf = 0;
    if (ended || !last) return;
    const ev = last;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!started) {
      if (Math.hypot(dx, dy) < threshold) return;
      started = true;
      cb.onStart?.();
    }
    cb.onMove(dx, dy, ev);
  };

  const onPointerMove = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return;
    last = ev;
    if (!raf) raf = requestAnimationFrame(flush);
  };

  const finish = (kind: "up" | "cancel", ev?: PointerEvent) => {
    if (ended) return;
    // The release point must never trail the pointer: apply the last queued
    // movement synchronously before committing.
    if (kind === "up" && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      flush();
    }
    ended = true;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    teardown();
    active = null;
    if (kind === "cancel") {
      if (started) cb.onCancel?.();
      return;
    }
    if (started) cb.onEnd?.();
    else if (ev) cb.onTap?.(ev);
  };

  const onPointerUp = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return;
    finish("up", ev);
  };
  const onPointerCancel = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return;
    finish("cancel");
  };
  // Fires when the capture element leaves the DOM (the dragged field was
  // deleted under us) or the capture is stolen — and also, guarded by
  // `ended`, after our own release in teardown.
  const onLostCapture = () => finish("cancel");
  const onBlur = () => finish("cancel");
  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape" || !started) return;
    // Capture phase: cancel the drag AND keep Escape from reaching the
    // builder's deselect shortcut — the selection survives a cancelled drag.
    ev.stopPropagation();
    ev.preventDefault();
    finish("cancel");
  };

  captureEl.addEventListener("pointermove", onPointerMove);
  captureEl.addEventListener("pointerup", onPointerUp);
  captureEl.addEventListener("pointercancel", onPointerCancel);
  captureEl.addEventListener("lostpointercapture", onLostCapture);
  window.addEventListener("blur", onBlur);
  window.addEventListener("keydown", onKeyDown, true);

  const teardown = () => {
    if (cb.cursor) {
      document.body.style.removeProperty("cursor");
      document.body.removeAttribute("data-sp-gesture");
    }
    captureEl.removeEventListener("pointermove", onPointerMove);
    captureEl.removeEventListener("pointerup", onPointerUp);
    captureEl.removeEventListener("pointercancel", onPointerCancel);
    captureEl.removeEventListener("lostpointercapture", onLostCapture);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("keydown", onKeyDown, true);
    try {
      captureEl.releasePointerCapture(e.pointerId);
    } catch {
      // Already released (pointerup) or never captured.
    }
  };

  active = {
    cancel: () => finish("cancel"),
    started: () => started,
  };
}
