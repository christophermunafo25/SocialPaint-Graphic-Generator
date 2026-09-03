import React, { useState } from "react";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import type { NotificationPrefs } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useColorScheme, type ColorScheme } from "@/lib/colorScheme";
import { InlineEdit } from "../../InlineEdit";
import { Switch } from "../../Switch";
import { ControlRow, DevBackendNotice, SettingsCard } from "./settingsShared";

const SCHEMES: Array<{ key: ColorScheme; label: string; Icon: typeof Sun; hint: string }> = [
  { key: "system", label: "System", Icon: Monitor, hint: "Follow the OS preference" },
  { key: "light", label: "Light", Icon: Sun, hint: "Always light chrome" },
  { key: "dark", label: "Dark", Icon: Moon, hint: "Always dark chrome" },
];

/** The one section every member can reach: their own profile, appearance,
 * notification preferences, and the way out. */
export function AccountSection() {
  const { company, role, user, backend, signOut } = useAuth();
  const { scheme, setScheme } = useColorScheme();
  const accountAvailable = stores.account.isAvailable() && user !== null;
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {error && (
        <p
          role="alert"
          className="px-4 py-3"
          data-radius-card
          style={{ background: "var(--danger-wash)", color: "var(--destructive)" }}
        >
          {error}
        </p>
      )}

      <SettingsCard title="Profile">
        <div
          className="grid gap-x-6 gap-y-2"
          style={{ gridTemplateColumns: "140px 1fr", fontSize: "var(--type-label-size)" }}
        >
          <span style={{ color: "var(--text-muted)" }}>Email</span>
          <span style={{ color: "var(--text-primary)" }}>
            {user?.email ?? "None (dev backend)"}
          </span>
          <span style={{ color: "var(--text-muted)" }}>Role</span>
          <span className="capitalize" style={{ color: "var(--text-primary)" }}>
            {role}
          </span>
          <span style={{ color: "var(--text-muted)" }}>Workspace</span>
          <span style={{ color: "var(--text-primary)" }}>{company?.name ?? "—"}</span>
          <span style={{ color: "var(--text-muted)" }}>Backend</span>
          <span style={{ color: "var(--text-primary)" }}>
            {backend === "supabase" ? "Supabase (live)" : "Local dev (browser storage)"}
          </span>
        </div>
        {accountAvailable ? <DisplayNameRow onError={setError} /> : null}
      </SettingsCard>

      <SettingsCard
        title="Appearance"
        description="Applies to the SocialPaint chrome only. Template graphics and exports are identical in both modes."
      >
        <div className="grid grid-cols-3 gap-2">
          {SCHEMES.map(({ key, label, Icon, hint }) => (
            <button
              key={key}
              onClick={() => setScheme(key)}
              title={hint}
              className="flex flex-col items-center gap-1.5 py-3"
              data-radius-card
              style={{
                border: `1px solid ${scheme === key ? "transparent" : "var(--border-strong)"}`,
                background: scheme === key ? "var(--sb-active-bg)" : "var(--bg-surface)",
                color: scheme === key ? "var(--sb-fg-active)" : "var(--text-primary)",
                fontSize: 12.5,
              }}
            >
              <Icon
                style={{
                  width: 16,
                  height: 16,
                  color: scheme === key ? "var(--sb-fg-active)" : "var(--text-secondary)",
                }}
              />
              {label}
            </button>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Notifications"
        description="Preferences only for now. Email delivery isn't set up yet, so nothing sends either way. What you choose here is honored the day it is."
      >
        {accountAvailable ? (
          <NotificationRows userId={user!.id} onError={setError} />
        ) : (
          <DevBackendNotice>
            Notification preferences need the Supabase backend with auth enabled. This dev backend
            has no account to store them on.
          </DevBackendNotice>
        )}
      </SettingsCard>

      {signOut && (
        <button onClick={() => void signOut()} className="sp-btn sp-btn-ghost">
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      )}
    </div>
  );
}

function DisplayNameRow({ onError }: { onError(msg: string | null): void }) {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  const nameState = useAsync<string | null>(
    () => (user ? stores.account.getDisplayName(user.id) : Promise.resolve(null)),
    [user, version],
  );
  if (!user) return null;
  return (
    <InlineEdit
      label="Display name"
      value={nameState.status === "ready" ? (nameState.data ?? "") : ""}
      placeholder="Add a name"
      ariaLabel="Edit display name"
      maxLength={80}
      disabled={nameState.status !== "ready"}
      onSave={async (next) => {
        onError(null);
        try {
          await stores.account.setDisplayName(user.id, next);
          setVersion((v) => v + 1);
        } catch (e) {
          onError(e instanceof Error ? e.message : "Could not save your name.");
          throw e;
        }
      }}
    />
  );
}

const PREF_ROWS: Array<{ key: keyof NotificationPrefs; title: string; description: string }> = [
  {
    key: "inviteAccepted",
    title: "Invited members accepted",
    description: "When someone you invited joins the workspace.",
  },
  {
    key: "weeklyDigest",
    title: "Weekly usage digest",
    description: "A summary of opens and exports, once a week.",
  },
  {
    key: "linkExpiring",
    title: "Public link expiring soon",
    description: "Before a link you created stops working.",
  },
];

function NotificationRows({
  userId,
  onError,
}: {
  userId: string;
  onError(msg: string | null): void;
}) {
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const state = useAsync<NotificationPrefs>(
    () => stores.account.getNotificationPrefs(userId),
    [userId, version],
  );
  if (state.status === "loading") {
    return (
      <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>Loading…</p>
    );
  }
  if (state.status === "error") {
    return (
      <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>
        We couldn't load your preferences.{" "}
        <button onClick={state.retry} className="underline">
          Try again
        </button>
      </p>
    );
  }
  const prefs = state.data;
  const save = (patch: Partial<NotificationPrefs>) => {
    setBusy(true);
    onError(null);
    void stores.account
      .setNotificationPrefs(userId, { ...prefs, ...patch })
      .then(() => setVersion((v) => v + 1))
      .catch((e) => onError(e instanceof Error ? e.message : "Could not save that preference."))
      .finally(() => setBusy(false));
  };
  return (
    <div className="space-y-3">
      {PREF_ROWS.map(({ key, title, description }) => (
        <ControlRow
          key={key}
          title={title}
          description={description}
          control={
            <Switch
              checked={prefs[key]}
              disabled={busy}
              onChange={(next) => save({ [key]: next })}
              ariaLabel={title}
            />
          }
        />
      ))}
    </div>
  );
}
