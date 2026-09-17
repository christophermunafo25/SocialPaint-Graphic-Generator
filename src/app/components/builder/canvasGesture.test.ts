// The gesture core's event wiring runs against real browser globals only —
// the repo ships no DOM test environment (and adds no dependencies for one),
// so these tests stand up the minimal window/document/rAF surface the module
// touches. What matters is the contract, not the DOM: window-level delivery
// (capture is an enhancement), blur committing a started drag, Escape
// cancelling, and tap-under-threshold.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startDrag, cancelActiveGesture, type DragCallbacks } from "./canvasGesture";

/** rAF stub with a manual pump, so tests control when queued moves flush —
 * mirroring the one-frame batching the real thing gets from the browser. */
let rafQueue: Map<number, FrameRequestCallback>;
let rafId: number;
const runRaf = () => {
  const cbs = [...rafQueue.values()];
  rafQueue.clear();
  for (const cb of cbs) cb(0);
};

const bodyStub = {
  style: { setProperty: vi.fn(), removeProperty: vi.fn() },
  setAttribute: vi.fn(),
  removeAttribute: vi.fn(),
};

beforeEach(() => {
  rafQueue = new Map();
  rafId = 0;
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", { body: bodyStub });
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafQueue.set(++rafId, cb);
    return rafId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafQueue.delete(id);
  });
});

afterEach(() => {
  cancelActiveGesture();
  vi.unstubAllGlobals();
});

/** A capture element whose setPointerCapture THROWS — the worst case the
 * window-level listeners must survive. */
const throwingCaptureEl = () =>
  ({
    setPointerCapture: () => {
      throw new DOMException("InvalidPointerId");
    },
    releasePointerCapture: () => {},
  }) as unknown as HTMLElement;

const press = { pointerId: 1, clientX: 100, clientY: 100 };

const pointerEvent = (type: string, x: number, y: number, pointerId = 1) => {
  const ev = new Event(type);
  Object.assign(ev, { pointerId, clientX: x, clientY: y, shiftKey: false });
  return ev;
};

const callbacks = () => ({
  onStart: vi.fn(),
  onMove: vi.fn(),
  onEnd: vi.fn(),
  onCancel: vi.fn(),
  onTap: vi.fn(),
});

const drag = (cb: Partial<DragCallbacks>, el = throwingCaptureEl()) =>
  startDrag(press, el, { onMove: () => {}, ...cb });

describe("startDrag", () => {
  it("delivers moves and the release through window even when capture throws", () => {
    const cb = callbacks();
    drag(cb);
    window.dispatchEvent(pointerEvent("pointermove", 120, 130));
    runRaf();
    expect(cb.onStart).toHaveBeenCalledTimes(1);
    expect(cb.onMove).toHaveBeenCalledWith(20, 30, expect.anything());
    window.dispatchEvent(pointerEvent("pointerup", 120, 130));
    expect(cb.onEnd).toHaveBeenCalledTimes(1);
    expect(cb.onCancel).not.toHaveBeenCalled();
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it("ignores events from other pointers", () => {
    const cb = callbacks();
    drag(cb);
    window.dispatchEvent(pointerEvent("pointermove", 200, 200, 99));
    runRaf();
    window.dispatchEvent(pointerEvent("pointerup", 200, 200, 99));
    expect(cb.onMove).not.toHaveBeenCalled();
    expect(cb.onEnd).not.toHaveBeenCalled();
  });

  it("commits (not cancels) a started drag on window blur", () => {
    const cb = callbacks();
    drag(cb);
    window.dispatchEvent(pointerEvent("pointermove", 150, 100));
    runRaf();
    window.dispatchEvent(new Event("blur"));
    expect(cb.onEnd).toHaveBeenCalledTimes(1);
    expect(cb.onCancel).not.toHaveBeenCalled();
  });

  it("applies a still-queued move before the blur commit", () => {
    const cb = callbacks();
    drag(cb);
    window.dispatchEvent(pointerEvent("pointermove", 150, 100));
    runRaf();
    // A second move sits in the rAF queue, unflushed, when blur lands.
    window.dispatchEvent(pointerEvent("pointermove", 180, 100));
    window.dispatchEvent(new Event("blur"));
    expect(cb.onMove).toHaveBeenLastCalledWith(80, 0, expect.anything());
    expect(cb.onEnd).toHaveBeenCalledTimes(1);
  });

  it("does nothing on blur before the threshold — no commit, no tap", () => {
    const cb = callbacks();
    drag(cb);
    window.dispatchEvent(new Event("blur"));
    expect(cb.onEnd).not.toHaveBeenCalled();
    expect(cb.onCancel).not.toHaveBeenCalled();
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it("cancels on Escape and swallows the key", () => {
    const cb = callbacks();
    drag(cb);
    window.dispatchEvent(pointerEvent("pointermove", 150, 150));
    runRaf();
    const esc = new Event("keydown", { cancelable: true });
    Object.assign(esc, { key: "Escape" });
    window.dispatchEvent(esc);
    expect(cb.onCancel).toHaveBeenCalledTimes(1);
    expect(cb.onEnd).not.toHaveBeenCalled();
    expect(esc.defaultPrevented).toBe(true);
  });

  it("reports a release under the threshold as a tap, never a drag", () => {
    const cb = callbacks();
    drag(cb);
    window.dispatchEvent(pointerEvent("pointermove", 101, 101));
    runRaf();
    window.dispatchEvent(pointerEvent("pointerup", 101, 101));
    expect(cb.onTap).toHaveBeenCalledTimes(1);
    expect(cb.onStart).not.toHaveBeenCalled();
    expect(cb.onEnd).not.toHaveBeenCalled();
  });

  it("removes its window listeners after the gesture ends", () => {
    const cb = callbacks();
    drag(cb);
    window.dispatchEvent(pointerEvent("pointermove", 150, 150));
    runRaf();
    window.dispatchEvent(pointerEvent("pointerup", 150, 150));
    window.dispatchEvent(pointerEvent("pointermove", 300, 300));
    runRaf();
    window.dispatchEvent(new Event("blur"));
    expect(cb.onMove).toHaveBeenCalledTimes(1);
    expect(cb.onEnd).toHaveBeenCalledTimes(1);
  });
});
