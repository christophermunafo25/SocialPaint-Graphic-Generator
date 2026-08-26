import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Link2, RefreshCw, X } from "lucide-react";
import type { TemplateLink, TemplateSchema } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { publicLinkUrl } from "@/lib/publicLink/route";
import { ConfirmDialog } from "../ConfirmDialog";
import { ErrorState } from "../ErrorState";
import { Switch } from "../Switch";

/** Public links for one template: create, name, revoke, regenerate.
 *
 * The one behaviour to understand before reading the rest: a link's address
 * is shown exactly ONCE, when it is created or regenerated. Tokens are
 * stored hashed, so there is nothing to look up later. That is the point —
 * a database that can hand back a working address is a database that hands
 * one to whoever dumps it — and it makes "regenerate" the recovery path for
 * a lost link rather than an exotic action. The copy on this dialog says so
 * up front rather than letting an admin find out by closing it. */
export function TemplateLinksDialog({
  template,
  onClose,
}: {
  template: TemplateSchema;
  onClose(): void;
}) {
  const { company } = useAuth();
  const available = stores.publicLinks.isAvailable();

  const [links, setLinks] = useState<TemplateLink[] | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The one sight of a plaintext address, held only in this component's
   * state and never written anywhere. */
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<TemplateLink | null>(null);
  const [regenerating, setRegenerating] = useState<TemplateLink | null>(null);

  const load = useMemo(
    () => async () => {
      if (!company || !available) return;
      try {
        setLinks(await stores.publicLinks.list(company.id, template.id));
        setLoadError(null);
      } catch (e) {
        setLoadError(e instanceof Error ? e : new Error(String(e)));
      }
    },
    [company, available, template.id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Escape closes, as any modal should. Guarded on the confirmations: while
  // one is open it owns the key, and closing both at once would lose the
  // admin's place.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || revoking || regenerating) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, revoking, regenerating]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Public links for ${template.name}`}
    >
      <ConfirmDialog
        open={revoking !== null}
        title={`Revoke "${revoking?.name || "this link"}"?`}
        description="Anyone who opens it from here on gets a page saying the link no longer works. This takes effect immediately and cannot be undone — you'd create a new link instead."
        confirmLabel="Revoke link"
        onCancel={() => setRevoking(null)}
        onConfirm={() => {
          const link = revoking;
          setRevoking(null);
          if (!company || !link) return;
          void run(async () => {
            await stores.publicLinks.revoke(company.id, link.id);
            await load();
          });
        }}
      />
      <ConfirmDialog
        open={regenerating !== null}
        tone="primary"
        title={`Regenerate "${regenerating?.name || "this link"}"?`}
        description="You'll get a new address to share, and the old one stops working straight away. Anyone still holding the old address will need the new one."
        confirmLabel="Regenerate"
        onCancel={() => setRegenerating(null)}
        onConfirm={() => {
          const link = regenerating;
          setRegenerating(null);
          if (!company || !link) return;
          void run(async () => {
            const result = await stores.publicLinks.regenerate(company.id, link.id);
            setFreshUrl(publicLinkUrl(window.location.origin, result.token));
            await load();
          });
        }}
      />

      <div
        className="w-full max-w-xl p-6 space-y-4 overflow-y-auto"
        style={{
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-card)",
          maxHeight: "88vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between" style={{ gap: "var(--space-sm)" }}>
          <div className="min-w-0">
            <h2
              className="flex items-center gap-2"
              style={{
                fontFamily: "var(--font-head)",
                fontWeight: "var(--weight-head)",
                fontSize: 21,
                letterSpacing: "var(--track-head)",
                color: "var(--text-primary)",
              }}
            >
              <Link2 style={{ width: 18, height: 18 }} />
              Public links
            </h2>
            <p
              style={{
                fontSize: "var(--type-label-size)",
                color: "var(--text-muted)",
                marginTop: 2,
              }}
            >
              Anyone with the address fills in {template.name} and downloads the graphic. No
              account, no sign-in.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ flexShrink: 0 }}>
            <X style={{ width: 20, height: 20, color: "var(--text-muted)" }} />
          </button>
        </div>

        {!available ? (
          <p
            className="sp-card p-4"
            style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}
          >
            Public links need the Supabase backend. This session is running on the local development
            store, which has no way to issue or check a link.
          </p>
        ) : template.status !== "published" ? (
          <p
            className="sp-card p-4"
            style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}
          >
            Publish this template first. A link to a draft would refuse the moment someone opened
            it.
          </p>
        ) : (
          <>
            {freshUrl && (
              <FreshLink url={freshUrl} copied={copied} onCopy={() => void copy(freshUrl)} />
            )}

            {error && (
              <p
                role="alert"
                style={{ fontSize: "var(--type-caption-size)", color: "var(--state-danger)" }}
              >
                {error}
              </p>
            )}

            <CreateLinkForm
              busy={busy}
              onCreate={(input) => {
                if (!company) return;
                void run(async () => {
                  const result = await stores.publicLinks.create(company.id, template.id, input);
                  setFreshUrl(publicLinkUrl(window.location.origin, result.token));
                  await load();
                });
              }}
            />

            {loadError ? (
              <ErrorState
                title="We couldn't load this template's links."
                detail="Check your connection and try again."
                onRetry={() => void load()}
              />
            ) : links === null ? (
              <p
                className="text-center py-6"
                style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}
              >
                Loading…
              </p>
            ) : links.length === 0 ? (
              <p
                className="text-center py-6"
                style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}
              >
                No links yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.id}>
                    <LinkRow
                      link={link}
                      busy={busy}
                      onRevoke={() => setRevoking(link)}
                      onRegenerate={() => setRegenerating(link)}
                      onToggleUploads={(next) => {
                        if (!company) return;
                        void run(async () => {
                          await stores.publicLinks.update(company.id, link.id, {
                            allowUploads: next,
                          });
                          await load();
                        });
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** The one sight of a working address. Prominent, selectable, and explicit
 * that it will not be shown again — the whole workflow is paste-into-an-email,
 * so the copy button is the primary action and it is focused on mount. */
function FreshLink({ url, copied, onCopy }: { url: string; copied: boolean; onCopy(): void }) {
  const copyRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    copyRef.current?.focus();
  }, [url]);
  return (
    <div
      className="sp-card p-4 space-y-2"
      style={{ border: "1px solid var(--state-primary)" }}
      role="status"
      aria-live="polite"
    >
      <p className="sp-eyebrow">Copy this now — it isn't shown again</p>
      <input
        readOnly
        value={url}
        aria-label="Public link address"
        className="sp-input"
        style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button ref={copyRef} onClick={onCopy} className="sp-btn sp-btn-primary w-full">
        {copied ? (
          <Check style={{ width: 14, height: 14 }} />
        ) : (
          <Copy style={{ width: 14, height: 14 }} />
        )}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

function CreateLinkForm({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate(input: {
    name?: string;
    expiresAt?: string | null;
    useCap?: number | null;
    allowUploads?: boolean;
  }): void;
}) {
  const [name, setName] = useState("");
  const [expires, setExpires] = useState("");
  const [cap, setCap] = useState("");
  const [allowUploads, setAllowUploads] = useState(true);

  const submit = () => {
    const capValue = cap.trim() ? Number(cap.trim()) : null;
    onCreate({
      name: name.trim() || undefined,
      // A date input gives a day, not an instant. End of that day in the
      // admin's own timezone is what "dies after the event" means to them.
      expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      useCap: capValue && Number.isFinite(capValue) && capValue > 0 ? capValue : null,
      allowUploads,
    });
    setName("");
    setExpires("");
    setCap("");
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="sp-card p-4 space-y-3">
      <h3 className="sp-panel-title">New link</h3>
      <div>
        <label
          htmlFor="link-name"
          className="sp-eyebrow block"
          style={{ marginBottom: "var(--space-3xs)" }}
        >
          Name
        </label>
        <input
          id="link-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Speaker confirmation email"
          className="sp-input"
        />
        <p
          style={{
            fontSize: "var(--type-caption-size)",
            color: "var(--text-muted)",
            marginTop: "var(--space-3xs)",
          }}
        >
          For you, not for whoever opens it — it's how you tell your links apart later.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "var(--space-xs)" }}>
        <div>
          <label
            htmlFor="link-expires"
            className="sp-eyebrow block"
            style={{ marginBottom: "var(--space-3xs)" }}
          >
            Stops working after
          </label>
          <input
            id="link-expires"
            type="date"
            min={today}
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className="sp-input"
          />
        </div>
        <div>
          <label
            htmlFor="link-cap"
            className="sp-eyebrow block"
            style={{ marginBottom: "var(--space-3xs)" }}
          >
            Open limit
          </label>
          <input
            id="link-cap"
            type="number"
            min={1}
            inputMode="numeric"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            placeholder="No limit"
            className="sp-input"
          />
        </div>
      </div>
      <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
        Both are optional. The limit counts opens, including someone refreshing the page — set it
        comfortably above the number of people you're sending it to.
      </p>

      <div className="flex items-start justify-between" style={{ gap: "var(--space-sm)" }}>
        <div className="min-w-0">
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
            Allow photo uploads
          </p>
          <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
            {allowUploads
              ? "Photos are cropped in the visitor's own browser and go straight into their graphic — they never reach us."
              : "Photo fields are hidden. The graphic exports with an empty placeholder where a photo would go."}
          </p>
        </div>
        <Switch
          checked={allowUploads}
          onChange={setAllowUploads}
          ariaLabel="Allow photo uploads through this link"
        />
      </div>

      <button onClick={submit} disabled={busy} className="sp-btn sp-btn-primary w-full">
        {busy ? (
          <RefreshCw className="animate-spin" style={{ width: 14, height: 14 }} />
        ) : (
          <Link2 style={{ width: 14, height: 14 }} />
        )}
        Create link
      </button>
    </div>
  );
}

/** One link's state at a glance. Everything an admin asks about a link they
 * are deciding whether to revoke: what it is, whether it still works, how
 * much it has been used, and when it was last touched. */
function LinkRow({
  link,
  busy,
  onRevoke,
  onRegenerate,
  onToggleUploads,
}: {
  link: TemplateLink;
  busy: boolean;
  onRevoke(): void;
  onRegenerate(): void;
  onToggleUploads(next: boolean): void;
}) {
  const state = linkState(link);
  return (
    <div className="sp-card p-4 space-y-2">
      <div className="flex items-start justify-between" style={{ gap: "var(--space-2xs)" }}>
        <div className="min-w-0">
          <p
            className="truncate"
            style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}
          >
            {link.name || "Untitled link"}
          </p>
          <span
            className="sp-eyebrow"
            style={{ color: state.live ? "var(--state-primary)" : "var(--text-muted)" }}
          >
            {state.label}
          </span>
        </div>
        <div className="flex items-center" style={{ gap: "var(--space-3xs)", flexShrink: 0 }}>
          <button onClick={onRegenerate} disabled={busy} className="sp-btn sp-btn-ghost">
            New address
          </button>
          {!link.revokedAt && (
            <button
              onClick={onRevoke}
              disabled={busy}
              className="sp-btn sp-btn-ghost"
              style={{ color: "var(--state-danger)" }}
            >
              Revoke
            </button>
          )}
        </div>
      </div>

      <dl
        className="grid grid-cols-2 sm:grid-cols-4"
        style={{ gap: "var(--space-2xs)", fontSize: "var(--type-caption-size)" }}
      >
        <Stat label="Created" value={shortDate(link.createdAt)} />
        <Stat label="Expires" value={link.expiresAt ? shortDate(link.expiresAt) : "Never"} />
        <Stat
          label="Opens"
          value={link.useCap ? `${link.useCount} of ${link.useCap}` : String(link.useCount)}
        />
        <Stat label="Last used" value={link.lastUsedAt ? shortDate(link.lastUsedAt) : "Never"} />
      </dl>

      <div className="flex items-center justify-between" style={{ gap: "var(--space-2xs)" }}>
        <span style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
          Photo uploads
        </span>
        <Switch
          checked={link.allowUploads}
          onChange={onToggleUploads}
          disabled={busy || Boolean(link.revokedAt)}
          ariaLabel={`Allow photo uploads through ${link.name || "this link"}`}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="sp-eyebrow">{label}</dt>
      <dd style={{ color: "var(--text-secondary)" }}>{value}</dd>
    </div>
  );
}

/** The admin's view of why a link would refuse. The PUBLIC page shows one
 * message for all of these — a visitor cannot act on the difference — but an
 * admin absolutely can, and this is the one place the distinction belongs. */
function linkState(link: TemplateLink): { label: string; live: boolean } {
  if (link.revokedAt) return { label: `Revoked ${shortDate(link.revokedAt)}`, live: false };
  if (link.expiresAt && Date.parse(link.expiresAt) <= Date.now()) {
    return { label: `Expired ${shortDate(link.expiresAt)}`, live: false };
  }
  if (link.useCap !== null && link.useCount >= link.useCap) {
    return { label: "Open limit reached", live: false };
  }
  return { label: "Active", live: true };
}

const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
