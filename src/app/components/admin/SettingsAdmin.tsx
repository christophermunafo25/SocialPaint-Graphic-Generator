import React from "react";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useColorScheme, type ColorScheme } from "@/lib/colorScheme";
import { Page, PageHeader } from "../layout/Page";

const SCHEMES: Array<{ key: ColorScheme; label: string; Icon: typeof Sun; hint: string }> = [
  { key: "system", label: "System", Icon: Monitor, hint: "Follow the OS preference" },
  { key: "light", label: "Light", Icon: Sun, hint: "Always light chrome" },
  { key: "dark", label: "Dark", Icon: Moon, hint: "Always dark chrome" },
];

/** Settings & Admin — the sidebar's sixth destination. Workspace facts,
 * appearance, and account. People management lives on its own page. */
export function SettingsAdmin() {
  const { company, role, user, backend, signOut } = useAuth();
  const { scheme, setScheme } = useColorScheme();

  return (
    <Page narrow={760}>
      <PageHeader
        title="Settings & Admin"
        description="Workspace, appearance, and account. Members and roles are managed on the People page."
      />
      <div className="space-y-6">

      <div className="sp-card sp-card--content space-y-3">
        <h2 className="sp-panel-title">Workspace</h2>
        <div className="grid gap-x-6 gap-y-2" style={{ gridTemplateColumns: "140px 1fr", fontSize: 13 }}>
          <span style={{ color: "var(--text-muted)" }}>Name</span>
          <span style={{ color: "var(--text-primary)" }}>{company?.name ?? "—"}</span>
          <span style={{ color: "var(--text-muted)" }}>Slug</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-primary)" }}>
            {company?.slug ?? "—"}
          </span>
          <span style={{ color: "var(--text-muted)" }}>Backend</span>
          <span style={{ color: "var(--text-primary)" }}>
            {backend === "supabase" ? "Supabase (live)" : "Local dev (browser storage)"}
          </span>
        </div>
      </div>

      <div className="sp-card sp-card--content space-y-3">
        <h2 className="sp-panel-title">Appearance</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Applies to the SocialPaint chrome only — template graphics and
          exports are identical in both modes.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {SCHEMES.map(({ key, label, Icon, hint }) => (
            <button
              key={key}
              onClick={() => setScheme(key)}
              title={hint}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl"
              style={{
                border: `1px solid ${scheme === key ? "transparent" : "var(--border-strong)"}`,
                background: scheme === key ? "var(--sb-active-bg)" : "var(--bg-surface)",
                color: scheme === key ? "var(--sb-fg-active)" : "var(--text-primary)",
                fontSize: 12.5,
              }}
            >
              <Icon style={{ width: 16, height: 16, color: scheme === key ? "var(--sb-fg-active)" : "var(--text-secondary)" }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="sp-card sp-card--content space-y-3">
        <h2 className="sp-panel-title">Account</h2>
        <div className="grid gap-x-6 gap-y-2" style={{ gridTemplateColumns: "140px 1fr", fontSize: 13 }}>
          <span style={{ color: "var(--text-muted)" }}>Email</span>
          <span style={{ color: "var(--text-primary)" }}>{user?.email ?? "— (dev backend)"}</span>
          <span style={{ color: "var(--text-muted)" }}>Role</span>
          <span className="capitalize" style={{ color: "var(--text-primary)" }}>{role}</span>
        </div>
        {signOut && (
          <button onClick={() => void signOut()} className="sp-btn sp-btn-ghost">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        )}
      </div>
      </div>
    </Page>
  );
}
