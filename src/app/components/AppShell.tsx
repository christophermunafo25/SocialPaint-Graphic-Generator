import React from "react";
import { Sidebar } from "./Sidebar";
import { ChromeProvider } from "./layout/ChromeContext";

/** The app frame (every page frame of the new brand file; RULES.md section
 * 10): the Sidebar and Main on surface/page. At 1024 and wider the window
 * is the frame, 12 around and 12 between the two, and only Main's content
 * scrolls (layout/Page.tsx). Below 1024 the mobile bar sits on top and the
 * document scrolls. Tenant brand kits style the graphics, never this shell.
 *
 * Every child of `.sp-appshell` but `main` is the app's chrome: Generate's
 * editor sheet makes each one inert while it is open, and below 1024 a
 * full-viewport surface hangs its layout off `.sp-appshell`
 * (`[data-sp-fullscreen]` in socialpaint.css). */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ChromeProvider>
      <div className="sp-appshell">
        <Sidebar />
        <main className="sp-main">{children}</main>
      </div>
    </ChromeProvider>
  );
}
