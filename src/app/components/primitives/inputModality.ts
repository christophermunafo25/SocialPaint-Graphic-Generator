/** Marks the root with how the member last acted: `data-input="keyboard"`
 * after a key, `data-input="pointer"` after the pointer presses or moves.
 *
 * A menu shows the ring on the item the keyboard is on and never on the one
 * under the pointer. `:focus-visible` cannot tell the two apart there: a
 * menu moves focus to the item the pointer is over, and a trigger that
 * cancels pointerdown leaves the browser thinking the keyboard is in use.
 * primitives.css reads the attribute for that one rule.
 *
 * One set of listeners for the whole app, installed on first use. */
let installed = false;

export function trackInputModality(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const root = document.documentElement;
  const set = (mode: "keyboard" | "pointer") => {
    if (root.dataset.input !== mode) root.dataset.input = mode;
  };
  let x = Number.NaN;
  let y = Number.NaN;
  window.addEventListener(
    "keydown",
    (e) => {
      // A modifier held on its own is not a move through the page.
      if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;
      set("keyboard");
    },
    true,
  );
  window.addEventListener("pointerdown", () => set("pointer"), true);
  window.addEventListener(
    "pointermove",
    (e) => {
      // A real move only: a pointer at rest still reports when the page
      // moves under it (a menu opening beneath it).
      if (e.clientX === x && e.clientY === y) return;
      x = e.clientX;
      y = e.clientY;
      set("pointer");
    },
    true,
  );
}

/** How the member last acted, as marked on the root (none before the first
 * key or pointer). */
export function inputModality(): "keyboard" | "pointer" | undefined {
  if (typeof document === "undefined") return undefined;
  const mode = document.documentElement.dataset.input;
  return mode === "keyboard" || mode === "pointer" ? mode : undefined;
}
