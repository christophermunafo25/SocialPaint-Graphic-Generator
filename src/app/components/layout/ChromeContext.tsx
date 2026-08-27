import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const LS_COLLAPSED = "sp-sidebar-collapsed";

interface ChromeState {
  /** How the desktop rail renders right now — the admin's preference unless
   * a full-viewport surface is overriding it. */
  sidebarCollapsed: boolean;
  /** Toggle from the rail's own control. While an override is active this
   * moves the override (the admin's stored preference is never rewritten by
   * a surface that only borrowed the rail for a while). */
  setSidebarCollapsed(next: boolean): void;
  /** Borrow the rail for the duration of a full-viewport surface. `true` on
   * mount collapses it; `false` on unmount hands it back to the preference,
   * whatever the admin did with it in between. */
  overrideSidebarCollapsed(on: boolean): void;
}

const ChromeContext = createContext<ChromeState | null>(null);

/** App-chrome state that more than one region needs to agree on. Today that
 * is exactly one thing: whether the sidebar shows as the icon rail. The
 * preference lives here rather than inside Sidebar because the Template
 * Builder takes the whole viewport and wants the rail out of the way for as
 * long as it is open — without spending the admin's stored preference. */
export function ChromeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPref] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LS_COLLAPSED) === "1";
    } catch {
      return false;
    }
  });
  /** null = nobody is borrowing the rail. */
  const [override, setOverride] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(LS_COLLAPSED, pref ? "1" : "0");
    } catch {
      // persistence is best-effort
    }
  }, [pref]);

  const setSidebarCollapsed = useCallback(
    (next: boolean) => {
      // Inside a borrowed period the admin's toggle moves the override, so
      // expanding the rail in the builder does not rewrite what every other
      // screen restores to.
      if (override !== null) setOverride(next);
      else setPref(next);
    },
    [override],
  );

  const overrideSidebarCollapsed = useCallback((on: boolean) => {
    setOverride(on ? true : null);
  }, []);

  const value = useMemo<ChromeState>(
    () => ({
      sidebarCollapsed: override ?? pref,
      setSidebarCollapsed,
      overrideSidebarCollapsed,
    }),
    [override, pref, setSidebarCollapsed, overrideSidebarCollapsed],
  );
  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}

export function useChrome(): ChromeState {
  const ctx = useContext(ChromeContext);
  if (!ctx) throw new Error("useChrome must be used inside ChromeProvider");
  return ctx;
}

/** Take the document out of the scroll business for as long as the calling
 * surface is mounted. Scoped to an attribute on `html` so every other route
 * keeps the normal document scroll — see the `[data-sp-fullscreen]` rules in
 * socialpaint.css. Reference-counted, so a remount mid-transition can't
 * leave the flag stuck on or clear it early. */
let fullViewportCount = 0;

export function useFullViewport(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    fullViewportCount += 1;
    document.documentElement.setAttribute("data-sp-fullscreen", "");
    return () => {
      fullViewportCount -= 1;
      if (fullViewportCount <= 0) {
        fullViewportCount = 0;
        document.documentElement.removeAttribute("data-sp-fullscreen");
      }
    };
  }, [active]);
}
