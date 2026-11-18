import React, { createContext, useCallback, useContext, useState } from "react";
import { Toast } from "../../primitives";

type Show = (message: string) => void;

const ToastContext = createContext<Show>(() => {});

/** How long a Settings toast shows. The Toast owns the timer and waits while
 * the pointer or focus is on it (ElevenLabs PROMPT.md section 7.2). */
export const SETTINGS_TOAST_MS = 4000;

/** Settings' one toast: a section calls `useSettingsToast()(message)` for
 * feedback that has no place on the page ("Invite sent to …", a failed role
 * change). It shows for four seconds, centred on the page column above the
 * legal links (PHASE-7 §9 D8), one at a time. */
export function SettingsToastProvider({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState<{ message: string; n: number } | null>(null);
  const show = useCallback<Show>((next) => {
    setShown((prev) => ({ message: next, n: (prev?.n ?? 0) + 1 }));
  }, []);
  const hide = useCallback(() => setShown(null), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="sp-st-toast-anchor">
        <Toast
          open={shown !== null}
          message={shown?.message}
          messageKey={shown?.n}
          duration={SETTINGS_TOAST_MS}
          onTimeout={hide}
        />
      </div>
    </ToastContext.Provider>
  );
}

export function useSettingsToast(): Show {
  return useContext(ToastContext);
}
