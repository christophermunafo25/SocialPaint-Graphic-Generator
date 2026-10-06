import React, { useState } from "react";
import { Download } from "lucide-react";
import type { Member } from "@/lib/stores/interfaces";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { buildWorkspaceExport } from "@/lib/export/workspaceExport";
import { toSlug } from "@/lib/companySettings";
import { Button, Select, SettingsCard } from "../../primitives";
import { ConfirmModal, TypedConfirmModal } from "./SettingsConfirm";
import { DevBackendNotice } from "./settingsShared";
import { useSettingsToast } from "./settingsToast";

type OnError = (msg: string | null) => void;

/** Settings › Advanced (13:15837), the ways out: take your data, hand the
 * keys over, or delete everything. Each action sits in its card's header;
 * transfer and delete keep their confirms (PHASE-7 §9 D5). */
export function AdvancedSection() {
  const toast = useSettingsToast();
  const onError: OnError = (msg) => msg && toast(msg);
  return (
    <div className="sp-st-section">
      <ExportCard onError={onError} />
      <TransferCard onError={onError} />
      <DeleteCard onError={onError} />
    </div>
  );
}

function ExportCard({ onError }: { onError: OnError }) {
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
      action={
        <Button kind="primary" icon={Download} disabled={busy} onClick={() => void exportData()}>
          {busy ? "Assembling…" : "Export as JSON"}
        </Button>
      }
    />
  );
}

function TransferCard({ onError }: { onError: OnError }) {
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

  const who = (m: Member) => (m.name ? `${m.name} (${m.email})` : m.email);

  return (
    <SettingsCard title="Transfer ownership">
      <ConfirmModal
        open={confirming}
        destructive={false}
        title={`Hand admin to ${target ? (target.name ?? target.email) : ""}?`}
        body="They become an admin and you become a member. Only they (or another admin) can give admin back to you afterwards."
        confirmLabel="Transfer"
        onCancel={() => setConfirming(false)}
        onConfirm={() => void transfer()}
      />
      {isDevAuth ? (
        <DevBackendNotice>
          Transferring ownership needs the Supabase backend with auth enabled. This dev backend has
          no real accounts.
        </DevBackendNotice>
      ) : membersState.status === "ready" && others.length === 0 ? (
        <p className="t-body-s sp-st-empty">
          There is nobody to transfer to because you are the only member. Invite someone in People
          first.
        </p>
      ) : (
        <div className="sp-st-transfer">
          <Select
            ariaLabel="Transfer ownership to"
            size="lg"
            placeholder="Choose a member…"
            value={targetId || undefined}
            options={others.map((m) => ({ value: m.userId, label: who(m) }))}
            onSelect={setTargetId}
          />
          <Button
            kind="primary"
            size="md"
            disabled={busy || !target}
            onClick={() => setConfirming(true)}
          >
            {busy ? "Transferring…" : "Transfer"}
          </Button>
        </div>
      )}
    </SettingsCard>
  );
}

function DeleteCard({ onError }: { onError: OnError }) {
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
      action={
        <Button kind="destructive" disabled={busy || !company} onClick={() => setConfirming(true)}>
          Delete this workspace
        </Button>
      }
    >
      <TypedConfirmModal
        open={confirming}
        title={`Delete ${company?.name ?? "this workspace"}?`}
        body={
          <>
            <p>This destroys, permanently and immediately:</p>
            <ul className="sp-st-confirm__list">
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
          </>
        }
        expected={company?.name ?? ""}
        confirmLabel="Delete workspace"
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void destroy()}
      />
    </SettingsCard>
  );
}
