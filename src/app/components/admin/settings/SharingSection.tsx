import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { CompanyTemplateLink, TemplateSchema } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { publicLinkUrl } from "@/lib/publicLink/route";
import { ConfirmDialog } from "../../ConfirmDialog";
import { ErrorState } from "../../ErrorState";
import { Switch } from "../../Switch";
import { TemplateLinksDialog } from "../TemplateLinksDialog";
import { ControlRow, DevBackendNotice, SettingsCard, TypedConfirmDialog } from "./settingsShared";

const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** The admin's view of why a link would refuse — same distinctions the
 * per-template dialog draws. */
function linkState(link: CompanyTemplateLink): { label: string; live: boolean } {
  if (link.revokedAt) return { label: `Revoked ${shortDate(link.revokedAt)}`, live: false };
  if (link.expiresAt && Date.parse(link.expiresAt) <= Date.now()) {
    return { label: `Expired ${shortDate(link.expiresAt)}`, live: false };
  }
  if (link.useCap !== null && link.useCount >= link.useCap) {
    return { label: "Open limit reached", live: false };
  }
  return { label: "Active", live: true };
}

/** Everything publicly reachable, in one table — inventory and emergency
 * control. Editing an individual link stays in the template's own dialog;
 * this section exists so "what of ours is on the open internet right now"
 * and "cut it all off" have answers. */
export function SharingSection() {
  const { company } = useAuth();
  const available = stores.publicLinks.isAvailable();
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState<CompanyTemplateLink | null>(null);
  const [regenerating, setRegenerating] = useState<CompanyTemplateLink | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  /** The one sight of a regenerated address. */
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /** Template whose full link dialog is open. */
  const [managing, setManaging] = useState<TemplateSchema | null>(null);

  const state = useAsync<CompanyTemplateLink[]>(
    () => (company && available ? stores.publicLinks.listAll(company.id) : Promise.resolve([])),
    [company, available, version],
  );
  const links = state.status === "ready" ? state.data : [];
  const active = links.filter((l) => linkState(l).live);
  const shown = showInactive ? links : active;

  const run = (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    void action()
      .catch((e) => setError(e instanceof Error ? e.message : "That didn't work. Try again."))
      .finally(() => {
        setBusy(false);
        reload();
      });
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const openDialog = (templateId: string) => {
    setError(null);
    void stores.templates
      .get(templateId)
      .then((t) => {
        if (t) setManaging(t);
        else setError("That template no longer exists.");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not open that template."));
  };

  if (!available) {
    return (
      <div className="space-y-6">
        <DevBackendNotice>
          Public links need the Supabase backend. This dev backend has no way to issue or check one.
        </DevBackendNotice>
        <LinkDefaultsCard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={revoking !== null}
        title={`Revoke “${revoking?.name || "this link"}”?`}
        description="Anyone who opens it from here on gets a page saying the link no longer works. Immediate, and not undoable. You'd create a new link instead."
        confirmLabel="Revoke link"
        onCancel={() => setRevoking(null)}
        onConfirm={() => {
          const link = revoking;
          setRevoking(null);
          if (!company || !link) return;
          run(async () => {
            await stores.publicLinks.revoke(company.id, link.id);
          });
        }}
      />
      <ConfirmDialog
        open={regenerating !== null}
        tone="primary"
        title={`Regenerate “${regenerating?.name || "this link"}”?`}
        description="You'll get a new address to share, and the old one stops working straight away."
        confirmLabel="Regenerate"
        onCancel={() => setRegenerating(null)}
        onConfirm={() => {
          const link = regenerating;
          setRegenerating(null);
          if (!company || !link) return;
          run(async () => {
            const result = await stores.publicLinks.regenerate(company.id, link.id);
            setFreshUrl(publicLinkUrl(window.location.origin, result.token));
          });
        }}
      />
      <TypedConfirmDialog
        open={revokingAll}
        title="Revoke every active link?"
        description={
          <p>
            All {active.length} active link{active.length === 1 ? "" : "s"} across every template
            stop working immediately. Anyone holding one gets a page saying it no longer works. This
            is the incident-response button. It cannot be undone, only re-shared link by link.
          </p>
        }
        expected={company?.name ?? ""}
        confirmLabel={`Revoke ${active.length} link${active.length === 1 ? "" : "s"}`}
        busy={busy}
        onCancel={() => setRevokingAll(false)}
        onConfirm={() => {
          setRevokingAll(false);
          if (!company) return;
          run(async () => {
            // One call per link so every revoke lands in the audit trail the
            // same way a single one does.
            for (const link of active) {
              await stores.publicLinks.revoke(company.id, link.id);
            }
          });
        }}
      />
      {managing && (
        <TemplateLinksDialog
          template={managing}
          onClose={() => {
            setManaging(null);
            reload();
          }}
        />
      )}

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

      {freshUrl && (
        <div
          className="sp-card p-4 space-y-2"
          style={{ border: "1px solid var(--state-primary)" }}
          role="status"
          aria-live="polite"
        >
          <p className="sp-eyebrow">Copy this now. It is not shown again</p>
          <input
            readOnly
            value={freshUrl}
            aria-label="Public link address"
            className="sp-input"
            style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button onClick={() => void copy(freshUrl)} className="sp-btn sp-btn-primary w-full">
            {copied ? (
              <Check style={{ width: 14, height: 14 }} />
            ) : (
              <Copy style={{ width: 14, height: 14 }} />
            )}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}

      <div className="sp-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 pt-4 pb-3">
          <div>
            <h2 className="sp-panel-title">Public links</h2>
            <p
              style={{
                fontSize: "var(--type-caption-size)",
                color: "var(--text-muted)",
                marginTop: 2,
              }}
            >
              Every link across every template. “Manage” opens the template's own dialog for full
              editing.
            </p>
          </div>
          <label
            className="flex items-center"
            style={{
              gap: "var(--space-2xs)",
              fontSize: "var(--type-caption-size)",
              color: "var(--text-secondary)",
            }}
          >
            Show revoked and expired
            <Switch
              checked={showInactive}
              onChange={setShowInactive}
              ariaLabel="Show revoked and expired links"
            />
          </label>
        </div>
        {state.status === "loading" ? (
          <p
            className="px-6 py-8 text-center"
            style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}
          >
            Loading…
          </p>
        ) : state.status === "error" ? (
          <ErrorState
            title="We couldn't load your links."
            detail="Check your connection and try again."
            onRetry={state.retry}
          />
        ) : shown.length === 0 ? (
          <p
            className="px-6 py-8 text-center"
            style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}
          >
            {links.length === 0
              ? "Nothing is publicly reachable. Links are created from a template's Share dialog."
              : "No active links. Toggle the filter to see revoked and expired ones."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: "var(--type-label-size)", minWidth: 760 }}>
              <thead>
                <tr className="text-left" style={{ borderBottom: "1px solid var(--border)" }}>
                  {[
                    "Template",
                    "Link",
                    "Status",
                    "Created",
                    "Last used",
                    "Opens",
                    "Expires",
                    "",
                  ].map((h, i) => (
                    <th
                      key={`${h}-${i}`}
                      className="sp-eyebrow px-4 py-3"
                      style={{ fontWeight: 400 }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((link) => {
                  const s = linkState(link);
                  return (
                    <tr key={link.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td
                        className="px-4 py-3"
                        style={{ color: "var(--text-primary)", fontWeight: 500 }}
                      >
                        {link.templateName}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                        {link.name || "Untitled link"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="sp-eyebrow"
                          style={{ color: s.live ? "var(--state-primary)" : "var(--text-muted)" }}
                        >
                          {s.label}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--type-caption-size)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {shortDate(link.createdAt)}
                      </td>
                      <td
                        className="px-4 py-3"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--type-caption-size)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {link.lastUsedAt ? shortDate(link.lastUsedAt) : "Never"}
                      </td>
                      <td
                        className="px-4 py-3"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--type-caption-size)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {link.useCap ? `${link.useCount} of ${link.useCap}` : link.useCount}
                      </td>
                      <td
                        className="px-4 py-3"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--type-caption-size)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {link.expiresAt ? shortDate(link.expiresAt) : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center justify-end"
                          style={{ gap: "var(--space-3xs)" }}
                        >
                          <button
                            onClick={() => openDialog(link.templateId)}
                            disabled={busy}
                            className="sp-btn sp-btn-ghost"
                          >
                            Manage
                          </button>
                          <button
                            onClick={() => setRegenerating(link)}
                            disabled={busy}
                            className="sp-btn sp-btn-ghost"
                          >
                            New address
                          </button>
                          {!link.revokedAt && (
                            <button
                              onClick={() => setRevoking(link)}
                              disabled={busy}
                              className="sp-btn sp-btn-ghost"
                              style={{ color: "var(--state-danger)" }}
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {active.length > 0 && (
        <SettingsCard
          title="Emergency"
          description="For an incident: sever everything public in one action."
        >
          <button
            onClick={() => setRevokingAll(true)}
            disabled={busy}
            className="sp-btn"
            style={{ background: "var(--state-danger)", color: "var(--bg-surface)" }}
          >
            Revoke all {active.length} active link{active.length === 1 ? "" : "s"}
          </button>
        </SettingsCard>
      )}

      <LinkDefaultsCard />
    </div>
  );
}

/** Defaults for NEW links — the initial state of the create form in
 * TemplateLinksDialog. Stored on the company; each link still sets its own
 * values. */
function LinkDefaultsCard() {
  const { company, refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const defaults = company?.linkDefaults ?? { allowUploads: true, expiryDays: null, useCap: null };
  const [expiryDays, setExpiryDays] = useState(
    defaults.expiryDays === null ? "" : String(defaults.expiryDays),
  );
  const [useCap, setUseCap] = useState(defaults.useCap === null ? "" : String(defaults.useCap));

  const save = (patch: Partial<typeof defaults>) => {
    if (!company) return;
    setBusy(true);
    setError(null);
    void stores.companies
      .update(company.id, { linkDefaults: { ...defaults, ...patch } })
      .then(() => refresh())
      .catch((e) => setError(e instanceof Error ? e.message : "Could not save the defaults."))
      .finally(() => setBusy(false));
  };

  const parsePositive = (raw: string): number | null => {
    const n = Number(raw.trim());
    return raw.trim() && Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  };

  return (
    <SettingsCard
      title="Defaults for new links"
      description="What the create form starts with. Each link can still be set individually."
    >
      {error && (
        <p
          role="alert"
          style={{ fontSize: "var(--type-caption-size)", color: "var(--state-danger)" }}
        >
          {error}
        </p>
      )}
      <ControlRow
        title="Allow photo uploads"
        control={
          <Switch
            checked={defaults.allowUploads}
            disabled={busy}
            onChange={(next) => save({ allowUploads: next })}
            ariaLabel="New links allow photo uploads by default"
          />
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "var(--space-xs)" }}>
        <div>
          <label
            htmlFor="link-default-expiry"
            className="sp-eyebrow block"
            style={{ marginBottom: "var(--space-3xs)" }}
          >
            Expires after (days)
          </label>
          <input
            id="link-default-expiry"
            type="number"
            min={1}
            inputMode="numeric"
            value={expiryDays}
            placeholder="Never"
            disabled={busy}
            onChange={(e) => setExpiryDays(e.target.value)}
            onBlur={() => save({ expiryDays: parsePositive(expiryDays) })}
            className="sp-input"
          />
        </div>
        <div>
          <label
            htmlFor="link-default-cap"
            className="sp-eyebrow block"
            style={{ marginBottom: "var(--space-3xs)" }}
          >
            Open limit
          </label>
          <input
            id="link-default-cap"
            type="number"
            min={1}
            inputMode="numeric"
            value={useCap}
            placeholder="No limit"
            disabled={busy}
            onChange={(e) => setUseCap(e.target.value)}
            onBlur={() => save({ useCap: parsePositive(useCap) })}
            className="sp-input"
          />
        </div>
      </div>
    </SettingsCard>
  );
}
