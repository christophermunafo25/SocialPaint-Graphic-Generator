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
