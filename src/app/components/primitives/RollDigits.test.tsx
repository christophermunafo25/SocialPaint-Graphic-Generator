import React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Metric } from "./Containers";
import { ROLL_IN, ROLL_OUT, ROLL_PX } from "./motion";

type Call = { el: HTMLElement; frames: Keyframe[]; options: KeyframeAnimationOptions };

describe("Metric roll", () => {
  let calls: Call[];
  let finish: Array<() => void>;
  const original = HTMLElement.prototype.animate;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    calls = [];
    finish = [];
    HTMLElement.prototype.animate = function (frames, options) {
      calls.push({
        el: this as HTMLElement,
        frames: frames as Keyframe[],
        options: options as KeyframeAnimationOptions,
      });
      let resolve!: () => void;
      const finished = new Promise<void>((r) => (resolve = r));
      finish.push(resolve);
      return { finished, cancel() {} } as unknown as Animation;
    };
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
  });
  afterEach(() => {
    HTMLElement.prototype.animate = original;
    window.matchMedia = originalMatchMedia;
  });

  const digits = (c: HTMLElement) => c.querySelector(".ui-roll__digits")!;

  it("reads the whole number once and hides the digits", () => {
    const { container } = render(<Metric label="Exports" value="1,128" roll={false} />);
    expect(container.querySelector(".sr-only")!.textContent).toBe("1,128");
    expect(digits(container).getAttribute("aria-hidden")).toBe("true");
    expect(digits(container).textContent).toBe("1,128");
  });

  it("swaps at once when the change is not the member's", () => {
    const { container, rerender } = render(<Metric label="Exports" value="1,128" roll={false} />);
    rerender(<Metric label="Exports" value="1,240" roll={false} />);
    expect(calls).toHaveLength(0);
    expect(digits(container).textContent).toBe("1,240");
  });

  it("rolls only the digits that changed, upward on a rise", async () => {
    const { container, rerender } = render(<Metric label="Exports" value="1,128" roll={false} />);
    rerender(<Metric label="Exports" value="1,148" roll />);
    // One slot changed (2 to 4): its old digit leaves, its new one arrives.
    expect(container.querySelectorAll(".ui-roll__slot")).toHaveLength(1);
    const out = calls.find((c) => c.el.hasAttribute("data-roll-out"))!;
    const inn = calls.find((c) => c.el.hasAttribute("data-roll-in"))!;
    expect(out.el.textContent).toBe("2");
    expect(inn.el.textContent).toBe("4");
    expect(out.frames[1].transform).toBe(`translateY(${-ROLL_PX}px)`);
    expect(inn.frames[0].transform).toBe(`translateY(${ROLL_PX}px)`);
    expect(out.options.duration).toBe(ROLL_OUT.duration);
    expect(inn.options.duration).toBe(ROLL_IN.duration);
    expect(inn.options.delay).toBe(ROLL_OUT.duration);
    await act(async () => finish.forEach((f) => f()));
    expect(container.querySelectorAll(".ui-roll__slot")).toHaveLength(0);
    expect(digits(container).textContent).toBe("1,148");
  });

  it("rolls downward when the number fell, and a lost digit rolls out to blank", () => {
    const { container, rerender } = render(<Metric label="Exports" value="1,000" roll={false} />);
    rerender(<Metric label="Exports" value="999" roll />);
    const out = calls.filter((c) => c.el.hasAttribute("data-roll-out"));
    expect(out[0].frames[1].transform).toBe(`translateY(${ROLL_PX}px)`);
    // "1" and "," go with nothing in their place.
    const slots = Array.from(container.querySelectorAll(".ui-roll__slot"));
    expect(slots[0].querySelector("[data-roll-in]")).toBeNull();
  });

  it("swaps at once under reduced motion", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    const { container, rerender } = render(<Metric label="Exports" value="1,128" roll={false} />);
    rerender(<Metric label="Exports" value="1,148" roll />);
    expect(calls).toHaveLength(0);
    expect(container.querySelectorAll(".ui-roll__slot")).toHaveLength(0);
    expect(digits(container).textContent).toBe("1,148");
  });

  it("a change landing mid-roll takes over, and the first roll's end leaves it alone", async () => {
    const { container, rerender } = render(<Metric label="Exports" value="10" roll={false} />);
    rerender(<Metric label="Exports" value="12" roll />);
    const first = [...finish];
    rerender(<Metric label="Exports" value="15" roll />);
    // The first roll finishing must not clear the second one's slots.
    await act(async () => first.forEach((f) => f()));
    expect(container.querySelectorAll(".ui-roll__slot")).toHaveLength(1);
    expect(container.querySelector("[data-roll-in]")!.textContent).toBe("5");
    await act(async () => finish.forEach((f) => f()));
    expect(container.querySelectorAll(".ui-roll__slot")).toHaveLength(0);
    expect(digits(container).textContent).toBe("15");
  });
});
