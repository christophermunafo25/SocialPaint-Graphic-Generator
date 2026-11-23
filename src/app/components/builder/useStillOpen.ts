import { useEffect, useRef } from "react";

/** Whether a dialog is still on screen, for an import that settles after
 * it closed: Cancel while it runs abandons the result. Set again on every
 * mount, so StrictMode's second mount counts as open. */
export function useStillOpen() {
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
    };
  }, []);
  return open;
}

/** Whether keyboard focus was lost: nothing has it, or only the page or the
 * dialog itself (the control that had it was removed, and the dialog took
 * it back). A dialog then hands it to the control that replaced it. */
export function focusLost(): boolean {
  const active = document.activeElement;
  return !active || active === document.body || active.getAttribute("role") === "dialog";
}
