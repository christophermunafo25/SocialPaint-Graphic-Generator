import React, { useEffect, useRef, useState } from "react";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { browserTimeZone, isValidSlug, listTimeZones, toSlug } from "@/lib/companySettings";
import { normalizeWebsite } from "@/lib/companyWebsite";
import { kitShape } from "../brand/kitPlumbing";
import { Field, Input, Select, SettingsCard } from "../../primitives";
import { ConfirmModal } from "./SettingsConfirm";
import { SwitchRow } from "./settingsShared";
import { WorkspacesCard } from "./WorkspacesCard";

/** Settings › Workspace (13:14570): the workspaces you belong to, then
 * Workspace details (name, slug, website, timezone) and the two brand
 * enforcement switches. Everything saves as it changes (PHASE-7 §9 D6). */
export function WorkspaceSection() {
  const { company, role } = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (!company) return null;
  // A member reaches this section only to switch workspaces (PHASE-3.md §9,
  // PHASE-7 §9 D3): the Workspaces card, and nothing they cannot change.
  if (role !== "admin") {
    return (
      <div className="sp-st-section">
        <WorkspacesCard />
      </div>
    );
  }

  return (
    <div className="sp-st-section">
      {error && (
        <p role="alert" className="t-body-s sp-st-error">
          {error}
        </p>
      )}
      <WorkspacesCard />
      <SettingsCard title="Workspace details">
        <div className="sp-st-grid">
          <NameField onError={setError} />
          <SlugField onError={setError} />
          <WebsiteField onError={setError} />
          <TimezoneField onError={setError} />
        </div>
      </SettingsCard>
      <BrandEnforcementCard onError={setError} />
    </div>
  );
}

/** Company name: saves on blur, optimistic with rollback; an empty name
 * puts the old one back. The sidebar reads the name from the auth
 * provider's company list, so a save refreshes it, no reload. */
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
    <Field label="Name">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        maxLength={80}
        disabled={saving}
      />
    </Field>
  );
}

/** Company website: saved as a bare domain plus optional path
 * (companyWebsite.ts owns the rule). Saves on blur like the name; an entry
 * that does not parse as a domain rolls back and says why on the error
 * line. Clearing the field clears the column. */
function WebsiteField({ onError }: { onError(msg: string | null): void }) {
  const { company, refresh } = useAuth();
  const [value, setValue] = useState(company?.website ?? "");
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setValue(company?.website ?? ""), [company?.website]);

  const save = async () => {
    if (!company) return;
    const raw = value.trim();
    const previous = company.website ?? "";
    const normalized = raw ? normalizeWebsite(raw) : "";
    if (normalized === null) {
      setInvalid(true);
      setValue(previous);
      return;
    }
    setInvalid(false);
    if (normalized === previous) {
      setValue(previous);
      return;
    }
    setSaving(true);
    onError(null);
    try {
      await stores.companies.update(company.id, { website: normalized });
      await refresh();
    } catch (e) {
      setValue(previous);
      onError(e instanceof Error ? e.message : "Could not save the website.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Field
      label="Website"
      error={invalid ? "That does not look like a domain. Try something like acme.com." : null}
    >
      <Input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setInvalid(false);
        }}
        onBlur={() => void save()}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder="acme.com"
        maxLength={200}
        disabled={saving}
        spellCheck={false}
        autoComplete="url"
      />
    </Field>
  );
}

/** The slug: availability checks as you type (the error line speaks only
 * when the id is taken or malformed), and leaving the field or Enter asks
 * the confirm, which names the consequence: old bookmarked URLs with the
 * old slug stop resolving. Cancel puts the old id back. Same character
 * rules onboarding's create uses (PHASE-7 §9 D6). */
function SlugField({ onError }: { onError(msg: string | null): void }) {
  const { company, refresh } = useAuth();
  const [value, setValue] = useState(company?.slug ?? "");
  const [availability, setAvailability] = useState<"unknown" | "checking" | "free" | "taken">(
    "unknown",
  );
  const [wantsConfirm, setWantsConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const checkTimer = useRef<number | undefined>(undefined);
  useEffect(() => setValue(company?.slug ?? ""), [company?.slug]);
  useEffect(() => () => window.clearTimeout(checkTimer.current), []);

  const normalized = toSlug(value);
  const changed = !!company && normalized !== company.slug;
  const valid = isValidSlug(normalized);

  // Debounced availability check against the unique constraint (via the
  // slug_available RPC: RLS hides other tenants' rows from a plain select).
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

  // Leaving the field asked for the change: confirm once the check is in.
  const confirming = wantsConfirm && changed && valid && availability === "free";
  useEffect(() => {
    if (wantsConfirm && (availability === "taken" || !valid || !changed)) setWantsConfirm(false);
  }, [wantsConfirm, availability, valid, changed]);

  const cancel = () => {
    setWantsConfirm(false);
    setValue(company?.slug ?? "");
  };

  const save = async () => {
    if (!company) return;
    setWantsConfirm(false);
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

  const error = !changed
    ? null
    : !valid
      ? "Lowercase letters, numbers, and dashes only."
      : availability === "taken"
        ? "That id is already taken."
        : null;

  return (
    <>
      <ConfirmModal
        open={confirming}
        title={`Change the workspace id to “${normalized}”?`}
        body="Any URL someone bookmarked with the old id stops resolving. Nothing inside the app breaks. This is about links people saved."
        confirmLabel="Change id"
        destructive={false}
        busy={saving}
        onCancel={cancel}
        onConfirm={() => void save()}
      />
      <Field label="Slug" error={error}>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => changed && setWantsConfirm(true)}
          onKeyDown={(e) => e.key === "Enter" && changed && setWantsConfirm(true)}
          maxLength={60}
          disabled={saving}
          spellCheck={false}
          autoComplete="off"
        />
      </Field>
    </>
  );
}

/** Workspace timezone: every admin-facing date, Insights day buckets
 * included, follows this zone, so the whole team reads the same numbers.
 * A company with no zone shows the browser's; a zone this runtime doesn't
 * know shows UTC. Type a few letters to jump (PHASE-7 §9 D7). */
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
    <Field label="Timezone">
      <Select
        ariaLabel="Timezone"
        size="lg"
        value={zones.includes(current) ? current : "UTC"}
        options={zones.map((z) => ({ value: z, label: z }))}
        onSelect={(z) => void save(z)}
        disabled={saving}
      />
    </Field>
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
    <SettingsCard title="Brand enforcement">
      <div className="sp-st-rows">
        <SwitchRow
          label="Fields may override bound type styles"
          checked={kit?.allowStyleOverride ?? false}
          disabled={busy}
          onChange={(next) => void save({ allowStyleOverride: next })}
        />
        <SwitchRow
          label="Allow colors outside the palette"
          checked={kit?.allowOffPalette ?? true}
          disabled={busy}
          onChange={(next) => void save({ allowOffPalette: next })}
        />
      </div>
    </SettingsCard>
  );
}
