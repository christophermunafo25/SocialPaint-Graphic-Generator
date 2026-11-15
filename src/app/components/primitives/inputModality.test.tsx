import { describe, expect, it } from "vitest";
import { trackInputModality } from "./inputModality";

const root = document.documentElement;
const move = (x: number, y: number) =>
  window.dispatchEvent(new MouseEvent("pointermove", { clientX: x, clientY: y, bubbles: true }));

describe("trackInputModality", () => {
  it("marks the root with the way the member last acted", () => {
    trackInputModality();
    // A second call installs nothing more.
    trackInputModality();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(root.dataset.input).toBe("keyboard");

    move(10, 10);
    expect(root.dataset.input).toBe("pointer");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(root.dataset.input).toBe("keyboard");
  });

  it("ignores a pointer at rest and a modifier held on its own", () => {
    trackInputModality();
    move(20, 20);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(root.dataset.input).toBe("keyboard");

    // The page moved under a resting pointer: the same place again.
    move(20, 20);
    expect(root.dataset.input).toBe("keyboard");

    window.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(root.dataset.input).toBe("pointer");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", bubbles: true }));
    expect(root.dataset.input).toBe("pointer");
  });
});
