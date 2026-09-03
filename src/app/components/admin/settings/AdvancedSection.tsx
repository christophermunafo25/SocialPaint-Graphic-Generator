import React, { useState } from "react";
import { Download } from "lucide-react";
import type { Member } from "@/lib/stores/interfaces";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { buildWorkspaceExport } from "@/lib/export/workspaceExport";
import { toSlug } from "@/lib/companySettings";
import { ConfirmDialog } from "../../ConfirmDialog";
import { DevBackendNotice, SettingsCard, TypedConfirmDialog } from "./settingsShared";

/** The ways out: take your data, hand the keys over, or delete everything. */
export function AdvancedSection() {
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
      <ExportCard onError={setError} />
      <TransferCard onError={setError} />
      <DeleteCard onError={setError} />
    </div>
  );
}

function ExportCard({ onError }: { onError(msg: string | null): void }) {
  const { company } = useAuth();
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    if (!company) return;
    setBusy(true);
    onError(null);
    try {
      const [brandKit, brandAssets, templates, members, usageEvents] = await Promise.all([
        stores.brandKits.getActive(company.id),
        stores.brandAssets.list(company.id),
        stores.templates.listAll(company.id),
        stores.people.list(company.id),
        stores.usage.listEvents(company.id),
      ]);
      const payload = buildWorkspaceExport({
        company,
        brandKit,
        brandAssets,
        templates,
        members,
        usageEvents,
      });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${toSlug(company.name) || "workspace"}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard
      title="Export workspace data"
      description="One JSON file: templates with their fields, the brand kit with type styles and guidelines, the member list with roles, and usage events. Backgrounds, fonts, and logos are referenced by their storage paths. The binary files are not in the export."
    >
      <button onClick={() => void exportData()} disabled={busy} className="sp-btn sp-btn-primary">
        <Download style={{ width: 14, height: 14 }} />
        {busy ? "Assembling…" : "Export as JSON"}
      </button>
    </SettingsCard>
  );
}

function TransferCard({ onError }: { onError(msg: string | null): void }) {
  const { company, user, isDevAuth, refresh } = useAuth();
  const [targetId, setTargetId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const membersState = useAsync<Member[]>(
    () => (company && !isDevAuth ? stores.people.list(company.id) : Promise.resolve([])),
    [company, isDevAuth],
  );
  const members = membersState.status === "ready" ? membersState.data : [];
  const others = members.filter((m) => m.userId !== user?.id);
  const target = others.find((m) => m.userId === targetId) ?? null;

  const transfer = async () => {
    setConfirming(false);
    if (!company || !user || !target) return;
    setBusy(true);
    onError(null);
    try {
      // Promote first, then demote self — at no instant is the company
      // without an admin.
      if (target.role !== "admin") {
        await stores.people.setRole(company.id, target.userId, "admin");
      }
      await stores.people.setRole(company.id, user.id, "member");
      await refresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Transfer failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard
      title="Transfer ownership"
      description="Make someone else the admin and step down to member yourself. They are promoted before you are demoted, so the workspace is never without an admin."
    >
      <ConfirmDialog
        open={confirming}
        tone="primary"
        title={`Hand admin to ${target?.email ?? ""}?`}
        description="They become an admin and you become a member. Only they (or another admin) can give admin back to you afterwards."
        confirmLabel="Transfer"
        onCancel={() => setConfirming(false)}
        onConfirm={() => void transfer()}
      />
      {isDevAuth ? (
        <DevBackendNotice>
          Transferring ownership needs the Supabase backend with auth enabled. This dev backend has
          no real accounts.
        </DevBackendNotice>
      ) : others.length === 0 ? (
        <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>
          There is nobody to transfer to because you are the only member. Invite someone on the
          People page first.
        </p>
      ) : (
        <div className="flex" style={{ gap: "var(--space-2xs)" }}>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="sp-input flex-1"
            aria-label="Transfer ownership to"
          >
            <option value="">Choose a member…</option>
            {others.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.email} ({m.role})
              </option>
            ))}
          </select>
          <button
            onClick={() => setConfirming(true)}
            disabled={busy || !target}
            className="sp-btn sp-btn-primary"
          >
            {busy ? "Transferring…" : "Transfer"}
          </button>
        </div>
      )}
    </SettingsCard>
  );
}

function DeleteCard({ onError }: { onError(msg: string | null): void }) {
  const { company, signOut, refresh } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  // Live counts, not hardcoded copy: the dialog states exactly what is
  // destroyed, from the same stores the rest of the app reads.
  const countsState = useAsync(async () => {
    if (!company) return null;
    const [templates, members, assets, links] = await Promise.all([
      stores.templates.listAll(company.id),
      stores.people.list(company.id).catch(() => []),
      stores.brandAssets.list(company.id),
      stores.publicLinks.isAvailable()
        ? stores.publicLinks.listAll(company.id).catch(() => [])
        : Promise.resolve([]),
    ]);
    return {
      templates: templates.length,
      members: members.length,
      assets: assets.length,
      links: links.length,
    };
  }, [company]);
  const counts = countsState.status === "ready" ? countsState.data : null;

  const destroy = async () => {
    if (!company) return;
    setBusy(true);
    onError(null);
    try {
      await stores.companies.delete(company.id);
      setConfirming(false);
      // Nothing left to stand in: the actor is signed out (or, in dev,
      // dropped back to whatever workspace remains).
      if (signOut) await signOut();
      else await refresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Deletion failed.");
      setBusy(false);
    }
  };

  return (
    <SettingsCard
      title="Delete workspace"
      description="Permanently removes everything this workspace ever made. There is no recovery."
    >
      <TypedConfirmDialog
        open={confirming}
        title={`Delete ${company?.name ?? "this workspace"}?`}
        description={
          <div className="space-y-2">
            <p>This destroys, permanently and immediately:</p>
            <ul style={{ paddingLeft: 18, listStyle: "disc" }}>
              <li>
                {counts ? counts.templates : "…"} template{counts?.templates === 1 ? "" : "s"} and
                their fields
              </li>
              <li>
                {counts ? counts.members : "…"} membership{counts?.members === 1 ? "" : "s"}
              </li>
              <li>
                {counts ? counts.assets : "…"} brand asset{counts?.assets === 1 ? "" : "s"}
              </li>
              <li>
                {counts ? counts.links : "…"} public link{counts?.links === 1 ? "" : "s"}
              </li>
              <li>the brand kit and all usage history</li>
            </ul>
            <p>You will be signed out when it completes.</p>
          </div>
        }
        expected={company?.name ?? ""}
        confirmLabel="Delete workspace"
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void destroy()}
      />
      <button
        onClick={() => setConfirming(true)}
        disabled={busy || !company}
        className="sp-btn"
        style={{ background: "var(--state-danger)", color: "var(--bg-surface)" }}
      >
        Delete this workspace
      </button>
    </SettingsCard>
  );
}
