import React from "react";
import { Sidebar } from "./Sidebar";

/** Platform chrome — SocialPaint design system. A persistent left sidebar
 * (Figma node 13:28) replaces the old topbar; content fills the rest. Tenant
 * brand kits style the graphics, never this shell. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col lg:flex-row"
      style={{ background: "var(--bg-canvas)", fontFamily: "var(--font-ui)" }}
    >
      <Sidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
