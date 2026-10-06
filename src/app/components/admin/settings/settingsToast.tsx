import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Toast } from "../../primitives";

type Show = (message: string) => void;

const ToastContext = createContext<Show>(() => {});

/** Settings' one toast: a section calls `useSettingsToast()(message)` for
 * feedback that has no place on the page ("Invite sent to …", a failed role
 * change). It shows for four seconds, centred on the page column above the
 * legal links (PHASE-7 §9 D8), one at a time. */
export function SettingsToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback<Show>((next) => {
    window.clearTimeout(timer.current);
    setMessage(next);
    timer.current = window.setTimeout(() => setMessage(null), 4000);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="sp-st-toast-anchor">{message && <Toast message={message} />}</div>
    </ToastContext.Provider>
  );
}

export function useSettingsToast(): Show {
  return useContext(ToastContext);
}
