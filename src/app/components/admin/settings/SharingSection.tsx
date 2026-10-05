import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { CompanyTemplateLink, TemplateSchema } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { publicLinkUrl } from "@/lib/publicLink/route";
import { ErrorState } from "../../ErrorState";
import { SkeletonRows } from "../../Skeleton";
import { Button, Field, Input, RowMenu, SettingsCard, Status, Switch } from "../../primitives";
import { TemplateLinksDialog } from "../TemplateLinksDialog";
import { ConfirmModal, TypedConfirmModal } from "./SettingsConfirm";
import { DevBackendNotice, SwitchRow } from "./settingsShared";
import { useSettingsToast } from "./settingsToast";

const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

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

/** Settings › Sharing (13:15384): everything publicly reachable, in one
 * table, the incident button, and the defaults new links start with.
 * Editing a link stays in its template's Public links dialog ("Manage" in
 * the row menu). An address is shown once, when it is made: there is no
 * Copy on a row, since only a hash of it is stored (PHASE-7 §9 D4). */
export function SharingSection() {
  const { company } = useAuth();
  const toast = useSettingsToast();
  const available = stores.publicLinks.isAvailable();
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const [showInactive, setShowInactive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState<CompanyTemplateLink | null>(null);
  const [regenerating, setRegenerating] = useState<CompanyTemplateLink | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  /** The one sight of a regenerated address. */
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
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
    void action()
      .catch((e) => toast(e instanceof Error ? e.message : "That didn't work. Try again."))
      .finally(() => {
        setBusy(false);
        reload();
      });
  };

  const openDialog = (templateId: string) => {
    void stores.templates
      .get(templateId)
      .then((t) => {
        if (t) setManaging(t);
        else toast("That template no longer exists.");
      })
      .catch((e) => toast(e instanceof Error ? e.message : "Could not open that template."));
  };

  const filter = (
    <label className="sp-st-filter">
      <span className="t-label-xs">Show revoked and expired</span>
      <Switch
        checked={showInactive}
        onChange={setShowInactive}
        ariaLabel="Show revoked and expired links"
      />
    </label>
  );

  if (!available) {
    return (
      <div className="sp-st-section">
        <SettingsCard title="Public links">
          <DevBackendNotice>
            Public links need the Supabase backend. This dev backend has no way to issue or check
            one.
          </DevBackendNotice>
        </SettingsCard>
        <LinkDefaultsCard />
      </div>
    );
  }

  const plural = (n: number) => `${n} active link${n === 1 ? "" : "s"}`;

  return (
    <div className="sp-st-section">
      <ConfirmModal
        open={revoking !== null}
        title={`Revoke “${revoking?.name || "this link"}”?`}
        body="Anyone who opens it from here on gets a page saying the link no longer works. Immediate, and not undoable. You'd create a new link instead."
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
      <ConfirmModal
        open={regenerating !== null}
        destructive={false}
        title={`Regenerate “${regenerating?.name || "this link"}”?`}
        body="You'll get a new address to share, and the old one stops working straight away."
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
      <TypedConfirmModal
        open={revokingAll}
        title="Revoke every active link?"
        body={`All ${plural(active.length)} across every template stop working immediately. Anyone holding one gets a page saying it no longer works. This is the incident-response button. It cannot be undone, only re-shared link by link.`}
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

      {freshUrl && <FreshAddress url={freshUrl} onDone={() => setFreshUrl(null)} />}

      <SettingsCard className="sp-st-gap-16" title="Public links" action={filter}>
        {state.status === "loading" ? (
          <SkeletonRows rows={3} inset="var(--space-xs) 0" label="Loading links" />
        ) : state.status === "error" ? (
          <ErrorState
            title="We couldn't load your links."
            detail="Check your connection and try again."
            onRetry={state.retry}
          />
        ) : shown.length === 0 ? (
          <p className="t-body-s sp-st-empty">
            {links.length === 0
              ? "Nothing is publicly reachable. Links are created from a template's Public links dialog."
              : "No active links. Turn on Show revoked and expired to see the others."}
          </p>
        ) : (
          <div className="sp-st-table-wrap">
            <table className="sp-st-table">
              <thead>
                <tr className="t-label-xs">
                  <th scope="col">Link</th>
                  <th scope="col">Opens</th>
                  <th scope="col">Last used</th>
                  <th scope="col">Expires</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((link) => {
                  const st = linkState(link);
                  const name = link.name || "Untitled link";
                  return (
                    <tr key={link.id}>
                      <td>
                        <span className="sp-st-link">
                          <span className="sp-st-link__name">
                            <span className="t-label-m">{name}</span>
                            <Status tone={st.live ? "active" : "neutral"} size="sm">
                              {st.label}
                            </Status>
                          </span>
                          <span className="t-label-xs sp-st-meta">{link.templateName}</span>
                        </span>
                      </td>
                      <td className="t-body-s">
                        {link.useCap ? `${link.useCount} of ${link.useCap}` : link.useCount}
                      </td>
                      <td className="t-body-s">
                        {link.lastUsedAt ? shortDate(link.lastUsedAt) : "Never"}
                      </td>
                      <td className="t-body-s">
                        {link.expiresAt ? shortDate(link.expiresAt) : "Never"}
                      </td>
                      <td>
                        <span className="sp-st-actions sp-st-actions--end">
                          {!link.revokedAt && (
                            <Button
                              kind="neutral"
                              size="sm"
                              disabled={busy}
                              aria-label={`Revoke ${name}`}
                              onClick={() => setRevoking(link)}
                            >
                              Revoke
                            </Button>
                          )}
                          <RowMenu
                            label={`More actions for ${name}`}
                            disabled={busy}
                            groups={[
                              {
                                items: [
                                  { label: "Manage", onSelect: () => openDialog(link.templateId) },
                                  {
                                    label: "New address",
                                    movesFocus: true,
                                    onSelect: () => setRegenerating(link),
                                  },
                                ],
                              },
                            ]}
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SettingsCard>

      {active.length > 0 && (
        <SettingsCard
          title="Emergency"
          action={
            <Button kind="neutral" disabled={busy} onClick={() => setRevokingAll(true)}>
              Revoke all {plural(active.length)}
            </Button>
          }
        />
      )}

      <LinkDefaultsCard />
    </div>
  );
}

/** The one sight of a regenerated address: selectable, with Copy link,
 * since the whole workflow is paste-into-an-email. Done puts it away for
 * good; nobody can show it again. */
function FreshAddress({ url, onDone }: { url: string; onDone(): void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <SettingsCard
      title="Your link is ready"
      action={
        <Button kind="neutral" onClick={onDone}>
          Done
        </Button>
      }
    >
      <div className="sp-st-fresh" role="status" aria-live="polite">
        <Input
          readOnly
          value={url}
          aria-label="Public link address"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button kind="primary" icon={copied ? Check : Copy} onClick={() => void copy()}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </SettingsCard>
  );
}

/** Defaults for NEW links: the initial state of the create form in
 * TemplateLinksDialog. Stored on the company; each link still sets its own
 * values. */
function LinkDefaultsCard() {
  const { company, refresh } = useAuth();
  const toast = useSettingsToast();
  const [busy, setBusy] = useState(false);
  const defaults = company?.linkDefaults ?? { allowUploads: true, expiryDays: null, useCap: null };
  const [expiryDays, setExpiryDays] = useState(
    defaults.expiryDays === null ? "" : String(defaults.expiryDays),
  );
  const [useCap, setUseCap] = useState(defaults.useCap === null ? "" : String(defaults.useCap));

  const save = (patch: Partial<typeof defaults>) => {
    if (!company) return;
    setBusy(true);
    void stores.companies
      .update(company.id, { linkDefaults: { ...defaults, ...patch } })
      .then(() => refresh())
      .catch((e) => toast(e instanceof Error ? e.message : "Could not save the defaults."))
      .finally(() => setBusy(false));
  };

  const parsePositive = (raw: string): number | null => {
    const n = Number(raw.trim());
    return raw.trim() && Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  };

  return (
    <SettingsCard title="Defaults for new links">
      <SwitchRow
        label="Allow photo uploads"
        checked={defaults.allowUploads}
        disabled={busy}
        onChange={(next) => save({ allowUploads: next })}
      />
      <div className="sp-st-grid">
        <Field label="Expires after (days)">
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={expiryDays}
            placeholder="Never"
            disabled={busy}
            onChange={(e) => setExpiryDays(e.target.value)}
            onBlur={() => save({ expiryDays: parsePositive(expiryDays) })}
          />
        </Field>
        <Field label="Open limit">
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={useCap}
            placeholder="No limit"
            disabled={busy}
            onChange={(e) => setUseCap(e.target.value)}
            onBlur={() => save({ useCap: parsePositive(useCap) })}
          />
        </Field>
      </div>
    </SettingsCard>
  );
}
