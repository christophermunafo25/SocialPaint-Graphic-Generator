import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

/** Platform chrome color scheme. "system" follows the OS preference live.
 * Template graphics are unaffected — the render canvas is a fixed surface. */
export type ColorScheme = "light" | "dark" | "system";

const STORAGE_KEY = "sp-color-scheme";

const readStored = (): ColorScheme => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
};

const systemPrefersDark = () =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

interface ColorSchemeState {
  /** The user's choice (may be "system"). */
  scheme: ColorScheme;
  /** What is actually applied right now. */
  resolved: "light" | "dark";
  setScheme(scheme: ColorScheme): void;
}

const Ctx = createContext<ColorSchemeState | null>(null);

export function ColorSchemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>(readStored);
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    readStored() === "dark" || (readStored() === "system" && systemPrefersDark())
      ? "dark"
      : "light",
  );

  // Apply the class and track the OS preference while in "system".
  useEffect(() => {
    const apply = () => {
      const dark = scheme === "dark" || (scheme === "system" && systemPrefersDark());
      // data-theme is what the design system scopes its tokens to; the .dark
      // class stays because Tailwind's dark: variant and theme.css key off it.
      document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
      setResolved(dark ? "dark" : "light");
    };
    apply();
    if (scheme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [scheme]);

  const setScheme = useCallback((next: ColorScheme) => {
    setSchemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private-mode storage failures just lose persistence, not the toggle.
    }
  }, []);

  return <Ctx.Provider value={{ scheme, resolved, setScheme }}>{children}</Ctx.Provider>;
}

export function useColorScheme(): ColorSchemeState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useColorScheme must be used inside ColorSchemeProvider");
  return ctx;
}
