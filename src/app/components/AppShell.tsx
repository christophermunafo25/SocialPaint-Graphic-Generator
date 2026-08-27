import React from "react";
import { Sidebar } from "./Sidebar";
import { ChromeProvider } from "./layout/ChromeContext";

/** Platform chrome — SocialPaint design system. A persistent left sidebar
 * (Figma node 13:28) replaces the old topbar; content fills the rest. Tenant
 * brand kits style the graphics, never this shell.
 *
 * The `sp-appshell` class is what a full-viewport surface (the Template
 * Builder) hangs its non-scrolling layout off — see `[data-sp-fullscreen]`
 * in socialpaint.css. Every other route keeps the document scroll. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ChromeProvider>
      <div
        className="sp-appshell min-h-screen flex flex-col lg:flex-row"
        style={{ background: "var(--bg-canvas)", fontFamily: "var(--font-ui)" }}
      >
        <Sidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </ChromeProvider>
  );
}
