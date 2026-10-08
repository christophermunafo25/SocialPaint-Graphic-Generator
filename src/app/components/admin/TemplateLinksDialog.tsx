import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "lucide-react";
import type {
  CompanyLinkDefaults,
  TemplateLink,
  TemplateSchema,
  TemplateVariant,
} from "@/lib/types";
import { hasVariants } from "@/lib/templates/variants";
import { templateAssetDependencies } from "@/lib/brand/assetUsage";
import { resolveImageUrl } from "@/lib/stores/supabase/signedUrls";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { publicLinkUrl } from "@/lib/publicLink/route";
import { ErrorState } from "../ErrorState";
import { Button, Field, Input, Modal, Select, Stat, Status, Switch } from "../primitives";

/** What a link-creating form sends. */
export interface NewLinkInput {
  name?: string;
  expiresAt?: string | null;
  useCap?: number | null;
  allowUploads?: boolean;
  pinnedVariantId?: string | null;
}

/** Public links for one template (new look, 168:758 and 168:846; PHASE-4
 * §9 D7): create, name, pin a look, revoke, regenerate. One dialog,
 * opened from the fill page, the template chat and Settings › Sharing.
 *
 * A new or regenerated link's address shows here right away, with Copy
 * link. Since migration 0033 (CJ, 2026-09-15) the token is also stored, so
 * Settings › Sharing and Insights can copy the link again later. Links made
 * before 0033 have no stored token; New address gives them one. */
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
  /** A just-created or regenerated address, shown with Copy link. */
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  /** Elements whose image no longer exists in storage. A link to this
   * template refuses on every open, uniformly, by design, so the one place
   * to say why is here, before the admin sends anything out. */
  const [missingAssets, setMissingAssets] = useState<string[] | null>(null);
  useEffect(() => {
    if (!available) return;
    let alive = true;
    const deps = templateAssetDependencies(template);
    void Promise.all(deps.map((d) => resolveImageUrl(d.source))).then((urls) => {
      if (!alive) return;
      setMissingAssets(deps.filter((_, i) => urls[i] === null).map((d) => d.label));
    });
    return () => {
      alive = false;
    };
  }, [template, available]);

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

  const update = (linkId: string, patch: Parameters<typeof stores.publicLinks.update>[2]) => {
    if (!company) return;
    void run(async () => {
      await stores.publicLinks.update(company.id, linkId, patch);
      await load();
    });
  };

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title="Public links" icon={Link}>
      <PublicLinksBody
        state={!available ? "unavailable" : template.status !== "published" ? "draft" : "ready"}
        variants={hasVariants(template) ? template.variants : undefined}
        defaults={company?.linkDefaults ?? { allowUploads: true, expiryDays: null, useCap: null }}
        links={links}
        loadError={loadError !== null}
        onRetryLoad={() => void load()}
        busy={busy}
        error={error}
        freshUrl={freshUrl}
        missingAssets={missingAssets}
        onCreate={(input) => {
          if (!company) return;
          void run(async () => {
            const result = await stores.publicLinks.create(company.id, template.id, input);
            setFreshUrl(publicLinkUrl(window.location.origin, result.token));
            await load();
          });
        }}
        onRevoke={(link) => {
          if (!company) return;
          void run(async () => {
            await stores.publicLinks.revoke(company.id, link.id);
            await load();
          });
        }}
        onRegenerate={(link) => {
          if (!company) return;
          void run(async () => {
            const result = await stores.publicLinks.regenerate(company.id, link.id);
            setFreshUrl(publicLinkUrl(window.location.origin, result.token));
            await load();
          });
        }}
        onPin={(link, next) => update(link.id, { pinnedVariantId: next })}
        onToggleUploads={(link, next) => update(link.id, { allowUploads: next })}
      />
    </Modal>
  );
}

/** The dialog's body: everything under the title, as props, so /dev/ui can
 * show it with sample links (the local backend issues none). */
export function PublicLinksBody({
  state,
  variants,
  defaults,
  links,
  loadError,
  onRetryLoad,
  busy,
  error,
  freshUrl,
  missingAssets,
  onCreate,
  onRevoke,
  onRegenerate,
  onPin,
  onToggleUploads,
}: {
  /** Ready, or why there is nothing to manage. */
  state: "ready" | "unavailable" | "draft";
  /** The template's looks, when there is more than one to pin. */
  variants?: TemplateVariant[];
  /** Workspace-level starting values (Settings › Sharing). */
  defaults: CompanyLinkDefaults;
  /** Null while loading. */
  links: TemplateLink[] | null;
  loadError: boolean;
  onRetryLoad(): void;
  busy: boolean;
  error: string | null;
  freshUrl: string | null;
  missingAssets: string[] | null;
  onCreate(input: NewLinkInput): void;
  onRevoke(link: TemplateLink): void;
  onRegenerate(link: TemplateLink): void;
  onPin(link: TemplateLink, next: string | null): void;
  onToggleUploads(link: TemplateLink, next: boolean): void;
}) {
  const [revoking, setRevoking] = useState<TemplateLink | null>(null);
  const [regenerating, setRegenerating] = useState<TemplateLink | null>(null);

  if (state === "unavailable") {
    return (
      <p className="t-body-s sp-links__note">
        Public links need the Supabase backend. This session is running on the local development
        store, which has no way to issue or check a link.
      </p>
    );
  }
  if (state === "draft") {
    return (
      <p className="t-body-s sp-links__note">
        Publish this template first. A link to a draft would refuse the moment someone opened it.
      </p>
    );
  }

  return (
    <>
      {/* The confirmations are Modals of their own, over this one. */}
      <Confirm
        open={revoking !== null}
        title={`Revoke "${revoking?.name || "this link"}"?`}
        body="Anyone who opens it from here on gets a page saying the link no longer works. This takes effect immediately and cannot be undone. You'd create a new link instead."
        confirmLabel="Revoke link"
        destructive
        onCancel={() => setRevoking(null)}
        onConfirm={() => {
          if (revoking) onRevoke(revoking);
          setRevoking(null);
        }}
      />
      <Confirm
        open={regenerating !== null}
        title={`Regenerate "${regenerating?.name || "this link"}"?`}
        body="You'll get a new address to share, and the old one stops working straight away. Anyone still holding the old address will need the new one."
        confirmLabel="Regenerate"
        onCancel={() => setRegenerating(null)}
        onConfirm={() => {
          if (regenerating) onRegenerate(regenerating);
          setRegenerating(null);
        }}
      />

      {freshUrl && <FreshLink url={freshUrl} />}

      {missingAssets && missingAssets.length > 0 && (
        <p role="alert" className="t-body-s sp-links__alert">
          Links to this template won't open right now.{" "}
          {missingAssets.length === 1
            ? `“${missingAssets[0]}” points at an image that no longer exists.`
            : `${missingAssets.map((m) => `“${m}”`).join(", ")} point at images that no longer exist.`}{" "}
          Replace {missingAssets.length === 1 ? "it" : "them"} in the builder; existing links start
          working as soon as the template is saved.
        </p>
      )}

      {error && (
        <p role="alert" className="t-caption-s sp-links__error">
          {error}
        </p>
      )}

      <CreateLinkForm busy={busy} defaults={defaults} variants={variants} onCreate={onCreate} />

      <hr className="sp-links__divider" />

      <section className="sp-links__list" aria-labelledby="sp-links-title">
        <h3 id="sp-links-title" className="t-label-m">
          Links
        </h3>
        {loadError ? (
          <ErrorState
            title="We couldn't load this template's links."
            detail="Check your connection and try again."
            onRetry={onRetryLoad}
          />
        ) : links === null ? (
          <p className="t-body-s sp-links__note">Loading…</p>
        ) : links.length === 0 ? (
          <p className="t-body-s sp-links__note">No links yet.</p>
        ) : (
          <ul className="sp-links__rows">
            {links.map((link) => (
              <li key={link.id}>
                <LinkRow
                  link={link}
                  busy={busy}
                  variants={variants}
                  onPin={(next) => onPin(link, next)}
                  onRevoke={() => setRevoking(link)}
                  onRegenerate={() => setRegenerating(link)}
                  onToggleUploads={(next) => onToggleUploads(link, next)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** A confirmation over the dialog: the question, what it does, Cancel and
 * the action. */
function Confirm({
  open,
  title,
  body,
  confirmLabel,
  destructive = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  onCancel(): void;
  onConfirm(): void;
}) {
  return (
    <Modal open={open} onOpenChange={(next) => !next && onCancel()} title={title}>
      <p className="t-body-s sp-links__confirm">{body}</p>
      <div className="sp-links__actions">
        <Button kind="neutral" size="lg" onClick={onCancel}>
          Cancel
        </Button>
        <Button kind={destructive ? "destructive" : "primary"} size="lg" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/** A just-made address: selectable, with Copy link focused
 * on arrival, since the whole workflow is paste-into-an-email. */
function FreshLink({ url }: { url: string }) {
  const copyRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    copyRef.current?.focus();
    setCopied(false);
  }, [url]);
  return (
    <div className="sp-links__fresh" role="status" aria-live="polite">
      <Field label="Your link is ready. Copy it here or later from Insights">
        <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      </Field>
      <Button
        ref={copyRef}
        kind="primary"
        size="lg"
        icon={Link}
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          });
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
}

/** The look options: "Visitor chooses" or one look. */
const lookOptions = (variants: TemplateVariant[]) => [
  { value: "", label: "Visitor chooses" },
  ...variants.map((v) => ({ value: v.id, label: v.isDefault ? `${v.name} (default)` : v.name })),
];

function CreateLinkForm({
  busy,
  defaults,
  variants,
  onCreate,
}: {
  busy: boolean;
  defaults: CompanyLinkDefaults;
  variants?: TemplateVariant[];
  onCreate(input: NewLinkInput): void;
}) {
  const [name, setName] = useState("");
  const [expires, setExpires] = useState(() => {
    if (defaults.expiryDays === null) return "";
    const d = new Date();
    d.setDate(d.getDate() + defaults.expiryDays);
    return d.toISOString().slice(0, 10);
  });
  const [cap, setCap] = useState(defaults.useCap === null ? "" : String(defaults.useCap));
  const [allowUploads, setAllowUploads] = useState(defaults.allowUploads);
  const [pinned, setPinned] = useState("");

  const submit = () => {
    const capValue = cap.trim() ? Number(cap.trim()) : null;
    onCreate({
      name: name.trim() || undefined,
      // A date input gives a day, not an instant. End of that day in the
      // admin's own timezone is what "dies after the event" means to them.
      expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      useCap: capValue && Number.isFinite(capValue) && capValue > 0 ? capValue : null,
      allowUploads,
      ...(variants ? { pinnedVariantId: pinned || null } : {}),
    });
    setName("");
    setExpires("");
    setCap("");
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="sp-links__form" aria-labelledby="sp-links-new">
      <h3 id="sp-links-new" className="t-label-m">
        New link
      </h3>
      <Field label="Name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Speaker confirmation email"
        />
      </Field>
      <div className="sp-links__pair">
        <Field label="Stops working after">
          <Input
            type="date"
            min={today}
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
        </Field>
        <Field label="Open limit">
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            placeholder="No limit"
          />
        </Field>
      </div>
      {variants && (
        <div className="ui-field">
          <span className="t-label-xs ui-field__label">Look</span>
          <Select
            ariaLabel="Which look this link opens"
            size="lg"
            value={pinned}
            options={lookOptions(variants)}
            onSelect={setPinned}
          />
        </div>
      )}
      <div className="sp-links__toggle">
        <span className="t-body-s">Allow photo uploads</span>
        <Switch
          checked={allowUploads}
          onChange={setAllowUploads}
          ariaLabel="Allow photo uploads through this link"
        />
      </div>
      <Button
        kind="primary"
        size="lg"
        icon={Link}
        onClick={submit}
        disabled={busy}
        aria-busy={busy || undefined}
      >
        Create link
      </Button>
    </section>
  );
}

/** One link's state at a glance: what it is, whether it still works, how
 * much it has been used, when it was last touched, its look and its photo
 * uploads (168:760, sp-link-row). */
function LinkRow({
  link,
  busy,
  variants,
  onPin,
  onRevoke,
  onRegenerate,
  onToggleUploads,
}: {
  link: TemplateLink;
  busy: boolean;
  variants?: TemplateVariant[];
  onPin(next: string | null): void;
  onRevoke(): void;
  onRegenerate(): void;
  onToggleUploads(next: boolean): void;
}) {
  const state = linkState(link);
  const name = link.name || "Untitled link";
  const off = busy || Boolean(link.revokedAt);
  return (
    <div className="sp-links__row">
      <div className="sp-links__rowhead">
        <span className="sp-links__rowname">
          <span className="t-label-m">{name}</span>
          <Status tone={state.live ? "active" : "neutral"}>{state.label}</Status>
        </span>
        <span className="sp-links__rowactions">
          <Button kind="neutral" size="sm" onClick={onRegenerate} disabled={busy}>
            New address
          </Button>
          {!link.revokedAt && (
            <Button kind="neutral" size="sm" onClick={onRevoke} disabled={busy}>
              Revoke
            </Button>
          )}
        </span>
      </div>
      <div className="sp-links__stats">
        <Stat label="Created" value={shortDate(link.createdAt)} />
        <Stat label="Expires" value={link.expiresAt ? shortDate(link.expiresAt) : "Never"} />
        <Stat
          label="Opens"
          value={link.useCap ? `${link.useCount} of ${link.useCap}` : String(link.useCount)}
        />
        <Stat label="Last used" value={link.lastUsedAt ? shortDate(link.lastUsedAt) : "Never"} />
      </div>
      {variants && (
        <div className="sp-links__toggle">
          <span className="t-body-s">Look</span>
          <Select
            ariaLabel={`Which look ${name} opens`}
            value={link.pinnedVariantId ?? ""}
            options={lookOptions(variants)}
            onSelect={(next) => onPin(next || null)}
            disabled={off}
            className="sp-links__look"
          />
        </div>
      )}
      <div className="sp-links__toggle">
        <span className="t-body-s">Photo uploads</span>
        <Switch
          checked={link.allowUploads}
          onChange={onToggleUploads}
          disabled={off}
          ariaLabel={`Allow photo uploads through ${name}`}
        />
      </div>
    </div>
  );
}

/** The admin's view of why a link would refuse. The PUBLIC page shows one
 * message for all of these — a visitor cannot act on the difference — but an
 * admin absolutely can, and this is the one place the distinction belongs.
 * Exported: the builder's resize confirmation counts live links with the
 * same definition, so the two surfaces can never disagree. */
export function linkState(link: TemplateLink): { label: string; live: boolean } {
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
