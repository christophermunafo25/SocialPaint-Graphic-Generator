import React, { useState } from "react";
import { Send, Trash2 } from "lucide-react";
import type { Role } from "@/lib/types";
import type { Member } from "@/lib/stores/interfaces";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { Page, PageHeader } from "../layout/Page";
import { ConfirmDialog } from "../ConfirmDialog";
import { ErrorState } from "../ErrorState";

/** Team management: invite by email, change roles, remove. Invites are sent
 * by the invite-member Edge Function (admin-verified server-side). */
export function PeopleAdmin() {
  const { company, user, isDevAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Bumped after mutations so the list reloads through the same hook. */
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const membersState = useAsync(
    () => (company ? stores.people.list(company.id) : Promise.resolve([])),
    [company, version],
  );
  const members = membersState.status === "ready" ? membersState.data : [];

  /** Member pending remove confirmation. */
  const [removing, setRemoving] = useState<Member | null>(null);

  const confirmRemove = () => {
    if (!company || !removing) return;
    void stores.people
      .remove(company.id, removing.userId)
      .then(reload)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed."));
    setRemoving(null);
  };

  const invite = async () => {
    if (!company || !email.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await stores.people.invite(company.id, email.trim().toLowerCase(), role);
      setNotice(`Invite sent to ${email.trim()}.`);
      setEmail("");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page narrow={900}>
      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.email ?? ""} from ${company?.name ?? "this company"}?`}
        confirmLabel="Remove member"
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
      <PageHeader
        title="People"
        description="Admins build and manage the brand; members use the portal to fill in templates."
      />

      {isDevAuth && (
        <p className="px-4 py-3 mb-5" data-radius-control style={{ fontSize: "var(--type-caption-size)", background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
          People management needs the Supabase backend with auth enabled — this dev backend has no
          real accounts.
        </p>
      )}

      <div className="flex gap-2 mb-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void invite()}
          placeholder="person@company.com"
          className="sp-input flex-1"
          style={{ height: 40 }}
        />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="sp-input" style={{ width: "auto", height: 40 }}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button className="sp-btn sp-btn-primary" style={{ height: 40 }} disabled={busy || !email.trim() || isDevAuth} onClick={() => void invite()}>
          <Send style={{ width: 13, height: 13 }} />
          {busy ? "Inviting…" : "Invite"}
        </button>
      </div>
      {error && <p style={{ fontSize: "var(--type-caption-size)", color: "var(--state-danger)", marginBottom: "var(--space-2xs)" }}>{error}</p>}
      {notice && <p style={{ fontSize: "var(--type-caption-size)", color: "var(--state-primary)", marginBottom: "var(--space-2xs)" }}>{notice}</p>}

      <div className="sp-card overflow-hidden mt-4">
        {membersState.status === "loading" ? (
          <p className="px-6 py-8 text-center" style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>Loading…</p>
        ) : membersState.status === "error" ? (
          <ErrorState
            title="We couldn't load your team."
            detail="Check your connection and try again."
            onRetry={membersState.retry}
          />
        ) : members.length === 0 ? (
          <p className="px-6 py-8 text-center" style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>
            No members yet.
          </p>
        ) : (
          members.map((m, i) => (
            <div
              key={m.userId}
              className="flex items-center gap-3"
              style={{ padding: "var(--space-xs) var(--space-md)", minHeight: 56, ...(i > 0 ? { borderTop: "1px solid var(--border)" } : {}) }}
            >
              <span
                className="flex-shrink-0"
                style={{ width: 26, height: 26, borderRadius: "var(--radius-pill)", display: "grid", placeItems: "center", overflow: "hidden", background: "var(--bg-raised)", border: "1px solid var(--border)" }}
              >
                <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-head)", fontWeight: 800, textTransform: "uppercase" as const, fontSize: 11, letterSpacing: "-0.01em" }}>
                  {(m.name ?? m.email).slice(0, 1).toUpperCase()}
                </span>
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate" style={{ fontSize: "var(--type-label-size)", color: "var(--text-primary)" }}>
                  {m.email}
                  {m.userId === user?.id && <span style={{ color: "var(--text-muted)" }}> (you)</span>}
                </p>
              </div>
              <select
                className="sp-input"
                style={{ width: "auto", padding: "5px 8px", fontSize: "var(--type-caption-size)" }}
                value={m.role}
                disabled={m.userId === user?.id}
                onChange={(e) => {
                  if (!company) return;
                  void stores.people
                    .setRole(company.id, m.userId, e.target.value as Role)
                    .then(reload)
                    .catch((err) => setError(err instanceof Error ? err.message : "Failed."));
                }}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button
                disabled={m.userId === user?.id}
                onClick={() => setRemoving(m)}
                aria-label={`Remove ${m.email}`}
                style={{ opacity: m.userId === user?.id ? 0.3 : 1 }}
              >
                <Trash2 style={{ width: 15, height: 15, color: "var(--state-danger)" }} />
              </button>
            </div>
          ))
        )}
      </div>
    </Page>
  );
}
