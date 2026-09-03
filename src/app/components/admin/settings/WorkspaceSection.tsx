import React, { useEffect, useRef, useState } from "react";
import { platformById, type CanvasSize } from "@/lib/templates/platforms";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { browserTimeZone, isValidSlug, listTimeZones, toSlug } from "@/lib/companySettings";
import { ConfirmDialog } from "../../ConfirmDialog";
import { ErrorState } from "../../ErrorState";
import { Switch } from "../../Switch";
import { kitShape } from "../brand/kitPlumbing";
import { ControlRow, SettingsCard } from "./settingsShared";

/** Workspace facts, finally editable: name, slug, timezone, the canvas
 * sizes this workspace offers, and the two brand enforcement switches. */
export function WorkspaceSection() {
  const { company } = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (!company) return null;

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
      <SettingsCard title="Workspace">
        <NameField onError={setError} />
        <SlugField onError={setError} />
        <TimezoneField onError={setError} />
      </SettingsCard>
      <CanvasSizesCard companyId={company.id} onError={setError} />
      <BrandEnforcementCard onError={setError} />
      <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
        Changes save as you make them. There is no page-level save button.
      </p>
    </div>
  );
}

/** Company name: plain input, saves on blur, optimistic with rollback. The
 * sidebar reads the name from the auth provider's company list, so a save
 * refreshes it — no reload. */
function NameField({ onError }: { onError(msg: string | null): void }) {
  const { company, refresh } = useAuth();
  const [value, setValue] = useState(company?.name ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(company?.name ?? ""), [company?.name]);

  const save = async () => {
    if (!company) return;
    const next = value.trim();
    if (!next || next === company.name) {
      setValue(company?.name ?? "");
      return;
    }
    const previous = company.name;
    setSaving(true);
    onError(null);
    try {
      await stores.companies.update(company.id, { name: next });
      await refresh();
    } catch (e) {
      setValue(previous);
      onError(e instanceof Error ? e.message : "Could not rename the workspace.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <label
        htmlFor="ws-name"
        className="sp-eyebrow block"
        style={{ marginBottom: "var(--space-3xs)" }}
      >
        Name
      </label>
      <input
        id="ws-name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        maxLength={80}
        disabled={saving}
        className="sp-input"
      />
    </div>
  );
}

/** The slug: inline-editable with a live availability check, and a
 * confirmation that names the consequence — old bookmarked URLs with the
 * old slug stop resolving. Same character rules onboarding's create uses. */
function SlugField({ onError }: { onError(msg: string | null): void }) {
  const { company, refresh } = useAuth();
  const [value, setValue] = useState(company?.slug ?? "");
  const [availability, setAvailability] = useState<"unknown" | "checking" | "free" | "taken">(
    "unknown",
  );
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const checkTimer = useRef<number | undefined>(undefined);
  useEffect(() => setValue(company?.slug ?? ""), [company?.slug]);
  useEffect(() => () => window.clearTimeout(checkTimer.current), []);

  const normalized = toSlug(value);
  const changed = company && normalized !== company.slug;
  const valid = isValidSlug(normalized);

  // Debounced availability check against the unique constraint (via the
  // slug_available RPC — RLS hides other tenants' rows from a plain select).
  useEffect(() => {
    window.clearTimeout(checkTimer.current);
    if (!company || !changed || !valid) {
      setAvailability("unknown");
      return;
    }
    setAvailability("checking");
    checkTimer.current = window.setTimeout(() => {
      stores.companies
        .isSlugAvailable(normalized, company.id)
        .then((free) => setAvailability(free ? "free" : "taken"))
        .catch(() => setAvailability("unknown"));
    }, 350);
  }, [normalized, changed, valid, company]);

  const save = async () => {
    if (!company) return;
    setConfirming(false);
    setSaving(true);
    onError(null);
    try {
      await stores.companies.update(company.id, { slug: normalized });
      await refresh();
    } catch (e) {
      setValue(company.slug);
      onError(e instanceof Error ? e.message : "Could not change the workspace id.");
    } finally {
      setSaving(false);
    }
  };

  const hint = !valid
    ? "Lowercase letters, numbers, and dashes only."
    : availability === "taken"
      ? "That id is already taken."
      : availability === "checking"
        ? "Checking availability…"
        : availability === "free"
          ? "Available."
          : "Part of how this workspace is addressed.";

  return (
    <div>
      <ConfirmDialog
        open={confirming}
        title={`Change the workspace id to “${normalized}”?`}
        description="Any URL someone bookmarked with the old id stops resolving. Nothing inside the app breaks. This is about links people saved."
        confirmLabel="Change id"
        tone="primary"
        onCancel={() => setConfirming(false)}
        onConfirm={() => void save()}
      />
      <label
        htmlFor="ws-slug"
        className="sp-eyebrow block"
        style={{ marginBottom: "var(--space-3xs)" }}
      >
        Slug
      </label>
      <div className="flex" style={{ gap: "var(--space-2xs)" }}>
        <input
          id="ws-slug"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={60}
          disabled={saving}
          spellCheck={false}
          autoComplete="off"
          className="sp-input flex-1"
          style={{ fontFamily: "var(--font-mono)", fontSize: "var(--type-caption-size)" }}
        />
        {changed && (
          <button
            onClick={() => setConfirming(true)}
            disabled={saving || !valid || availability !== "free"}
            className="sp-btn sp-btn-primary"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
      </div>
      <p
        style={{
          fontSize: "var(--type-caption-size)",
          color: availability === "taken" || !valid ? "var(--state-danger)" : "var(--text-muted)",
          marginTop: "var(--space-3xs)",
        }}
      >
        {hint}
      </p>
    </div>
  );
}

/** Workspace timezone: every admin-facing date — Insights day buckets
 * included — follows this zone, so the whole team reads the same numbers. */
function TimezoneField({ onError }: { onError(msg: string | null): void }) {
  const { company, refresh } = useAuth();
  const [saving, setSaving] = useState(false);
  const zones = listTimeZones();
  const current = company?.timezone ?? browserTimeZone();

  const save = async (zone: string) => {
    if (!company || zone === company.timezone) return;
    setSaving(true);
    onError(null);
    try {
      await stores.companies.update(company.id, { timezone: zone });
      await refresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not change the timezone.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <label
        htmlFor="ws-tz"
        className="sp-eyebrow block"
        style={{ marginBottom: "var(--space-3xs)" }}
      >
        Timezone
      </label>
      <select
        id="ws-tz"
        value={zones.includes(current) ? current : "UTC"}
        onChange={(e) => void save(e.target.value)}
        disabled={saving}
        className="sp-input"
      >
        {zones.map((z) => (
          <option key={z} value={z}>
            {z}
          </option>
        ))}
      </select>
      <p
        style={{
          fontSize: "var(--type-caption-size)",
          color: "var(--text-muted)",
          marginTop: "var(--space-3xs)",
        }}
      >
        Insights charts bucket days in this zone, so everyone reads the same daily numbers. Yours is{" "}
        {browserTimeZone()}.
      </p>
    </div>
  );
}

/** Which of the catalogue's canvas sizes this workspace shows in the
 * builder's size picker. Turning one off hides it here only — the catalogue
 * itself (SIZE_CATALOG in code) is never modified. */
function CanvasSizesCard({
  companyId,
  onError,
}: {
  companyId: string;
  onError(msg: string | null): void;
}) {
  const [version, setVersion] = useState(0);
  const state = useAsync<Array<{ size: CanvasSize; enabled: boolean }>>(
    () => stores.companies.listCanvasSizeSettings(companyId),
    [companyId, version],
  );
  const rows = state.status === "ready" ? state.data : [];
  const enabledCount = rows.filter((r) => r.enabled).length;

  const toggle = (sizeId: string, enabled: boolean) => {
    onError(null);
    void stores.companies
      .setCanvasSizeEnabled(companyId, sizeId, enabled)
      .then(() => setVersion((v) => v + 1))
      .catch((e) => onError(e instanceof Error ? e.message : "Could not save that change."));
  };

  return (
    <SettingsCard
      title="Canvas sizes"
      description="Sizes offered when someone creates a template. Turn off the ones this workspace never uses; custom sizes stay available in the builder."
    >
      {state.status === "loading" ? (
        <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>Loading…</p>
      ) : state.status === "error" ? (
        <ErrorState
          title="We couldn't load the canvas sizes."
          detail="Check your connection and try again."
          onRetry={state.retry}
        />
      ) : (
        <div className="space-y-3">
          {rows.map(({ size, enabled }) => (
            <ControlRow
              key={size.id}
              title={`${size.assetType} (${size.width}×${size.height})`}
              description={
                enabled && enabledCount === 1
                  ? "The last enabled size can't be turned off."
                  : size.platforms.map((p) => platformById(p).label).join(" · ")
              }
              control={
                <Switch
                  checked={enabled}
                  disabled={enabled && enabledCount === 1}
                  onChange={(next) => toggle(size.id, next)}
                  ariaLabel={`Offer ${size.assetType} ${size.width}×${size.height}`}
                />
              }
            />
          ))}
        </div>
      )}
    </SettingsCard>
  );
}

/** The two brand rules switches, stored on the brand kit and read by the
 * style resolver at render time — not a UI-layer gate. */
function BrandEnforcementCard({ onError }: { onError(msg: string | null): void }) {
  const { company } = useAuth();
  const brand = useBrand();
  const kit = brand.kit;
  const [busy, setBusy] = useState(false);

  const save = async (patch: { allowStyleOverride?: boolean; allowOffPalette?: boolean }) => {
    if (!company) return;
    setBusy(true);
    onError(null);
    try {
      // The kit is written whole; kitShape supplies the studio's defaults
      // when no kit exists yet, exactly as the studio itself would.
      await stores.brandKits.upsert(company.id, { ...kitShape(kit), ...patch });
      await brand.refresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not save that change.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard
      title="Brand enforcement"
      description="Applied when templates render. These switch the rules engine and leave the editing UI alone."
    >
      <ControlRow
        title="Fields may override bound type styles"
        description={
          kit?.allowStyleOverride
            ? "A field's own settings win; the bound style fills the gaps."
            : "Off: a bound style's font, color, and casing are locked, everywhere it is used."
        }
        control={
          <Switch
            checked={kit?.allowStyleOverride ?? false}
            disabled={busy}
            onChange={(next) => void save({ allowStyleOverride: next })}
            ariaLabel="Fields may override bound type styles"
          />
        }
      />
      <ControlRow
        title="Allow colors outside the palette"
        description={
          (kit?.allowOffPalette ?? true)
            ? "Any hex renders as authored."
            : "Off: a fill that isn't a brand color renders as the closest one in the palette."
        }
        control={
          <Switch
            checked={kit?.allowOffPalette ?? true}
            disabled={busy}
            onChange={(next) => void save({ allowOffPalette: next })}
            ariaLabel="Allow colors outside the palette"
          />
        }
      />
    </SettingsCard>
  );
}
