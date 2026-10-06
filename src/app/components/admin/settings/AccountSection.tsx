import React, { useRef, useState } from "react";
import { LogOut, Pencil } from "lucide-react";
import type { NotificationPrefs } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useColorScheme, type ColorScheme } from "@/lib/colorScheme";
import { SkeletonLines } from "../../Skeleton";
import { Button, Input, SegmentedControl, SettingsCard, Stat } from "../../primitives";
import { DevBackendNotice, SwitchRow } from "./settingsShared";
import { useSettingsToast } from "./settingsToast";

const SCHEMES: Array<{ id: ColorScheme; label: string }> = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

const ROLE_LABEL = { admin: "Admin", member: "Member" } as const;

/** Settings › Account (13:15649), the one section every member reaches:
 * their profile, appearance (per browser, PHASE-7 §9 D13), notification
 * preferences and the way out. */
export function AccountSection() {
  const { company, role, user, backend, signOut } = useAuth();
  const { scheme, setScheme } = useColorScheme();
  const toast = useSettingsToast();
  const accountAvailable = stores.account.isAvailable() && user !== null;
  const failed = (e: unknown, fallback: string) =>
    toast(e instanceof Error && e.message ? e.message : fallback);

  return (
    <div className="sp-st-section">
      <SettingsCard title="Profile">
        <div className="sp-st-grid sp-st-grid--stats">
          {accountAvailable && <DisplayName userId={user!.id} onFailed={failed} />}
          <Stat label="Email" value={user?.email ?? "None (dev backend)"} />
          <Stat label="Role" value={ROLE_LABEL[role]} />
          <Stat label="Workspace" value={company?.name ?? "None"} />
          {/* A dev aid, on the local backend only (D11). */}
          {backend !== "supabase" && <Stat label="Backend" value="Local dev (browser storage)" />}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Appearance"
        action={
          <SegmentedControl
            aria-label="Appearance"
            className="sp-st-appearance"
            options={SCHEMES}
            selectedId={scheme}
            onSelect={(id) => setScheme(id as ColorScheme)}
          />
        }
      />

      <SettingsCard title="Notifications">
        {accountAvailable ? (
          <NotificationRows userId={user!.id} isAdmin={role === "admin"} onFailed={failed} />
        ) : (
          <DevBackendNotice>
            Notification preferences need the Supabase backend with auth enabled. This dev backend
            has no account to store them on.
          </DevBackendNotice>
        )}
      </SettingsCard>

      {/* The way out, here since the sidebar lost its button (13:15828). */}
      {signOut && (
        <span>
          <Button kind="neutralOnPage" icon={LogOut} onClick={() => void signOut()}>
            Sign out
          </Button>
        </span>
      )}
    </div>
  );
}

/** Display name, with its pencil at rest (13:15777). Editing happens in
 * place on Input sm: Enter or leaving the field saves, Escape cancels, and
 * focus returns to the pencil. */
function DisplayName({
  userId,
  onFailed,
}: {
  userId: string;
  onFailed(e: unknown, fallback: string): void;
}) {
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState(false);
  const pencil = useRef<HTMLButtonElement>(null);
  const state = useAsync<string | null>(
    () => stores.account.getDisplayName(userId),
    [userId, version],
  );
  const name = state.status === "ready" ? (state.data ?? "") : "";

  const finish = (refocus: boolean) => {
    setEditing(false);
    if (refocus) window.setTimeout(() => pencil.current?.focus());
  };
  const save = async (raw: string, refocus: boolean) => {
    const next = raw.trim();
    finish(refocus);
    if (next === name) return;
    try {
      await stores.account.setDisplayName(userId, next);
      setVersion((v) => v + 1);
    } catch (e) {
      onFailed(e, "Could not save your name.");
    }
  };

  return (
    <Stat
      label="Display name"
      value={
        editing ? (
          <Input
            size="sm"
            aria-label="Display name"
            defaultValue={name}
            maxLength={80}
            autoFocus
            onFocus={(e) => e.target.select()}
            onBlur={(e) => void save(e.target.value, false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save(e.currentTarget.value, true);
              else if (e.key === "Escape") {
                e.stopPropagation();
                finish(true);
              }
            }}
          />
        ) : (
          <span className="sp-st-name">
            <span>{name || "Add a name"}</span>
            <button
              ref={pencil}
              type="button"
              className="ui-reset ui-ring sp-st-name__edit"
              aria-label="Edit display name"
              disabled={state.status !== "ready"}
              onClick={() => setEditing(true)}
            >
              <Pencil size={14} className="ui-icon" aria-hidden />
            </button>
          </span>
        )
      }
    />
  );
}

const PREF_ROWS: Array<{ key: keyof NotificationPrefs; title: string; adminOnly?: boolean }> = [
  // Only admins invite, so only they hear back (PHASE-7 §9 D10).
  { key: "inviteAccepted", title: "Invited members accepted", adminOnly: true },
  { key: "weeklyDigest", title: "Weekly usage digest" },
  { key: "linkExpiring", title: "Public link expiring soon" },
];

/** The three notification switches (13:15809). Preferences save and are
 * honoured once email delivery ships; nothing sends yet (D10). */
function NotificationRows({
  userId,
  isAdmin,
  onFailed,
}: {
  userId: string;
  isAdmin: boolean;
  onFailed(e: unknown, fallback: string): void;
}) {
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const state = useAsync<NotificationPrefs>(
    () => stores.account.getNotificationPrefs(userId),
    [userId, version],
  );
  if (state.status === "loading") {
    return <SkeletonLines lines={3} label="Loading preferences" />;
  }
  if (state.status === "error") {
    return (
      <p className="t-body-s sp-st-empty">
        We couldn't load your preferences.{" "}
        <button type="button" onClick={state.retry} className="ui-reset ui-ring sp-st-show-all">
          Try again
        </button>
      </p>
    );
  }
  const prefs = state.data;
  const save = (patch: Partial<NotificationPrefs>) => {
    setBusy(true);
    void stores.account
      .setNotificationPrefs(userId, { ...prefs, ...patch })
      .then(() => setVersion((v) => v + 1))
      .catch((e) => onFailed(e, "Could not save that preference."))
      .finally(() => setBusy(false));
  };
  return (
    <div className="sp-st-rows">
      {PREF_ROWS.filter((r) => isAdmin || !r.adminOnly).map(({ key, title }) => (
        <SwitchRow
          key={key}
          label={title}
          checked={prefs[key]}
          disabled={busy}
          onChange={(next) => save({ [key]: next })}
        />
      ))}
    </div>
  );
}
