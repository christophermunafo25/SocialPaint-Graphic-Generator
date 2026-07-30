import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Star, Trash2, Upload } from "lucide-react";
import type { BrandColor, BrandTypeStyle, FontRef, TemplateSchema } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { GOOGLE_FONTS, loadGoogleFonts, registerCustomFont } from "@/lib/render/fonts";
import { FONT_ACCEPT, validateFontFile } from "@/lib/brand/fontUpload";
import { DEFAULT_PALETTE, DEFAULT_TYPE_STYLES } from "@/lib/theme";
import { TypeStylesEditor } from "./TypeStylesEditor";
import { DesignSystemImportPanel } from "./DesignSystemImportPanel";
import { ColorControl } from "../ColorControl";
import { ConfirmDialog } from "../ConfirmDialog";
import { useFileDrop } from "@/lib/useFileDrop";
import { useUnsavedChangesWarning } from "@/lib/useUnsavedChangesWarning";

/** A font file mid-upload: chip enters, shimmers, flips to done, leaves. */
interface PendingFontChip {
  key: string;
  name: string;
  done: boolean;
  leaving: boolean;
}

/** Fields/templates bound to one style or color key. */
interface BindingUsage {
  fields: number;
  templateNames: string[];
}

const usageLabel = (u: BindingUsage | undefined): string =>
  !u || u.fields === 0
    ? "Not used yet"
    : `Used by ${u.fields} field${u.fields === 1 ? "" : "s"} in ${u.templateNames.length} template${u.templateNames.length === 1 ? "" : "s"}`;

/** Brand Studio: the company's palette, fonts (Google + uploaded), and logos.
 * Every template field styles itself from here — nothing is hardcoded. */
export function BrandStudio() {
  const { company } = useAuth();
  const { kit, assets, refresh } = useBrand();

  const [colors, setColors] = useState<BrandColor[]>(kit?.colors ?? DEFAULT_PALETTE);
  const [typeStyles, setTypeStyles] = useState<BrandTypeStyle[]>(kit?.typeStyles ?? DEFAULT_TYPE_STYLES);
  const [guidelines, setGuidelines] = useState<string[]>(kit?.guidelines ?? []);
  const [headingFont, setHeadingFont] = useState<FontRef>(kit?.headingFont ?? { source: "google", family: "Montserrat" });
  const [bodyFont, setBodyFont] = useState<FontRef>(kit?.bodyFont ?? { source: "google", family: "Inter" });
  const [primaryLogoAssetId, setPrimaryLogoAssetId] = useState(kit?.primaryLogoAssetId);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync the working copy from the kit ONLY when a different kit arrives
  // (company switch / first load). Plain object-identity deps would wipe
  // unsaved edits every time BrandContext refreshes (e.g. after an asset
  // upload) — the working copy must survive background refreshes.
  const syncedKitIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!kit || syncedKitIdRef.current === kit.id) return;
    syncedKitIdRef.current = kit.id;
    setColors(kit.colors);
    setTypeStyles(kit.typeStyles?.length ? kit.typeStyles : DEFAULT_TYPE_STYLES);
    setGuidelines(kit.guidelines ?? []);
    if (kit.headingFont) setHeadingFont(kit.headingFont);
    if (kit.bodyFont) setBodyFont(kit.bodyFont);
    setPrimaryLogoAssetId(kit.primaryLogoAssetId);
  }, [kit]);

  const fontAssets = assets.filter((a) => a.kind === "font");
  const logoAssets = assets.filter((a) => a.kind === "logo");

  // The blast radius: which fields across which templates bind to each type
  // style (typeStyleKey) and palette color (colorKey). Loaded alongside the
  // kit; if it's slow or fails, rows simply render without counts.
  const templatesState = useAsync<TemplateSchema[]>(
    () => (company ? stores.templates.listAll(company.id) : Promise.resolve([])),
    [company],
  );
  const templates = templatesState.status === "ready" ? templatesState.data : null;
  const bindings = useMemo(() => {
    const styleUse = new Map<string, BindingUsage>();
    const colorUse = new Map<string, BindingUsage>();
    const add = (map: Map<string, BindingUsage>, key: string, templateName: string) => {
      const u = map.get(key) ?? { fields: 0, templateNames: [] };
      u.fields += 1;
      if (!u.templateNames.includes(templateName)) u.templateNames.push(templateName);
      map.set(key, u);
    };
    for (const t of templates ?? []) {
      for (const f of t.fields) {
        if (f.typeStyleKey) add(styleUse, f.typeStyleKey, t.name);
        if (f.colorKey) add(colorUse, f.colorKey, t.name);
      }
    }
    return { styleUse, colorUse };
  }, [templates]);

  /** Pending impact confirmation for a save that restyles bound fields. */
  const [impact, setImpact] = useState<{
    fields: number;
    templateNames: string[];
    removals: boolean;
  } | null>(null);

  /** Diff the working copy against the saved kit; keys that changed or
   * disappeared AND are bound somewhere are the blast radius. */
  const computeImpact = () => {
    if (!kit || !templates) return null; // no baseline or unknown usage → don't block
    const affected: BindingUsage[] = [];
    let removals = false;
    for (const prev of kit.typeStyles ?? []) {
      const next = typeStyles.find((s) => s.key === prev.key);
      const use = bindings.styleUse.get(prev.key);
      if (!use || use.fields === 0) continue;
      if (!next) removals = true;
      if (!next || JSON.stringify(next) !== JSON.stringify(prev)) affected.push(use);
    }
    for (const prev of kit.colors ?? []) {
      const next = colors.find((c) => c.key === prev.key);
      const use = bindings.colorUse.get(prev.key);
      if (!use || use.fields === 0) continue;
      if (!next) removals = true;
      if (!next || next.hex !== prev.hex) affected.push(use);
    }
    if (!affected.length) return null;
    const names = [...new Set(affected.flatMap((u) => u.templateNames))];
    return { fields: affected.reduce((n, u) => n + u.fields, 0), templateNames: names, removals };
  };

  const requestSave = () => {
    const i = computeImpact();
    if (i) setImpact(i);
    else void save();
  };

  // Warn on close/reload while the working copy differs from the saved kit.
  const savedShape = JSON.stringify({
    colors: kit?.colors ?? [],
    typeStyles: kit?.typeStyles ?? [],
    guidelines: kit?.guidelines ?? [],
    headingFont: kit?.headingFont,
    bodyFont: kit?.bodyFont,
    primaryLogoAssetId: kit?.primaryLogoAssetId,
  });
  const workingShape = JSON.stringify({
    colors,
    typeStyles,
    guidelines,
    headingFont,
    bodyFont,
    primaryLogoAssetId,
  });
  useUnsavedChangesWarning(Boolean(kit) && savedShape !== workingShape);

  const save = async () => {
    if (!company) return;
    setSaving(true);
    setError(null);
    try {
      await stores.brandKits.upsert(company.id, {
        colors,
        typeStyles,
        guidelines,
        headingFont,
        bodyFont,
        primaryLogoAssetId,
      });
      await refresh(); // re-theme the app + reload fonts immediately
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const [pendingFonts, setPendingFonts] = useState<PendingFontChip[]>([]);

  const uploadFont = async (file: File) => {
    if (!company) return;
    const check = validateFontFile(file);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    const key = `${file.name}-${Date.now()}-${Math.random()}`;
    setPendingFonts((prev) => [
      ...prev,
      { key, name: check.metadata.family ?? file.name, done: false, leaving: false },
    ]);
    try {
      const asset = await stores.brandAssets.upload(company.id, "font", file, check.metadata);
      await registerCustomFont(asset); // usable immediately, export-safe
      // Done check → chip leaves → the real asset row enters in its place.
      setPendingFonts((prev) => prev.map((p) => (p.key === key ? { ...p, done: true } : p)));
      window.setTimeout(() => {
        setPendingFonts((prev) => prev.map((p) => (p.key === key ? { ...p, leaving: true } : p)));
        window.setTimeout(() => {
          setPendingFonts((prev) => prev.filter((p) => p.key !== key));
          void refresh();
        }, 260);
      }, 700);
    } catch (e) {
      setPendingFonts((prev) => prev.filter((p) => p.key !== key));
      setError(e instanceof Error ? e.message : "Font upload failed.");
    }
  };

  const uploadLogo = async (file: File) => {
    if (!company) return;
    const asset = await stores.brandAssets.upload(company.id, "logo", file);
    if (!logoAssets.length) setPrimaryLogoAssetId(asset.id);
    await refresh();
  };

  const fontDrop = useFileDrop((files) => {
    for (const f of files) void uploadFont(f);
  });
  const logoDrop = useFileDrop((files) => {
    if (files[0]) void uploadLogo(files[0]);
  });

  // Design-system import merges: existing keys win; new entries append.
  const mergeColors = (incoming: BrandColor[]) =>
    setColors((prev) => [...prev, ...incoming.filter((c) => !prev.some((p) => p.key === c.key))]);
  const mergeTypeStyles = (incoming: BrandTypeStyle[]) =>
    setTypeStyles((prev) => [...prev, ...incoming.filter((t) => !prev.some((p) => p.key === t.key))]);
  const mergeGuidelines = (incoming: string[]) =>
    setGuidelines((prev) => [...new Set([...prev, ...incoming])]);

  const fontOptions = (current: FontRef, set: (r: FontRef) => void) => (
    <select
      value={current.source === "custom" ? `custom:${current.assetId}` : `google:${current.family}`}
      onChange={(e) => {
        const [source, value] = e.target.value.split(":");
        if (source === "google") {
          loadGoogleFonts([value]);
          set({ source: "google", family: value });
        } else {
          const asset = fontAssets.find((a) => a.id === value);
          if (asset) set({ source: "custom", family: asset.metadata.family ?? asset.name, assetId: asset.id });
        }
      }}
      className="sp-input"
    >
      {fontAssets.length > 0 && (
        <optgroup label="Your uploaded fonts">
          {fontAssets.map((a) => (
            <option key={a.id} value={`custom:${a.id}`}>{a.metadata.family ?? a.name}</option>
          ))}
        </optgroup>
      )}
      <optgroup label="Google Fonts">
        {GOOGLE_FONTS.map((f) => (
          <option key={f} value={`google:${f}`}>{f}</option>
        ))}
      </optgroup>
    </select>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="sp-page-title">Brand Studio</h1>
          <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
            Colors, fonts, and logos every template inherits.
          </p>
        </div>
        <button
          onClick={requestSave}
          disabled={saving}
          className="sp-btn sp-btn-primary"
        >
          {savedTick ? <Check className="w-4 h-4" /> : null}
          {savedTick ? "Saved" : saving ? "Saving…" : "Save brand"}
        </button>
      </div>

      <ConfirmDialog
        open={impact !== null}
        title="Apply brand changes?"
        tone="primary"
        description={
          impact && (
            <>
              This restyles {impact.fields} field{impact.fields === 1 ? "" : "s"} across{" "}
              {impact.templateNames.length} template{impact.templateNames.length === 1 ? "" : "s"}.
              {impact.templateNames.length <= 10 && (
                <span className="block mt-2">{impact.templateNames.join(" · ")}</span>
              )}
              {impact.removals && (
                <span className="block mt-2">
                  Removed styles and colors release their fields back to each field's own settings.
                </span>
              )}
            </>
          )
        }
        confirmLabel="Apply changes"
        onCancel={() => setImpact(null)}
        onConfirm={() => {
          setImpact(null);
          void save();
        }}
      />

      {error && (
        <p className="mb-5 text-sm rounded-xl px-4 py-3" style={{ background: "var(--fill-danger-bg)", color: "var(--destructive)" }}>
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colors */}
        <section className="sp-card p-5 space-y-4">
          <h2 className="sp-panel-title">Colors</h2>
          <div className="space-y-2.5">
            {colors.map((c, i) => (
              <div key={c.key} className="flex items-center gap-3">
                <ColorControl
                  ariaLabel={`${c.name} color`}
                  value={c.hex}
                  onChange={(hex) => setColors(colors.map((x, j) => (j === i ? { ...x, hex } : x)))}
                />
                <div className="flex-1 min-w-0">
                  <input
                    value={c.name}
                    onChange={(e) => setColors(colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    className="text-sm font-semibold w-full bg-transparent outline-none"
                    style={{ color: "var(--foreground)" }}
                  />
                  {templates && (
                    <p style={{ fontSize: 11, color: "var(--fg-3)" }}>
                      {usageLabel(bindings.colorUse.get(c.key))}
                    </p>
                  )}
                </div>
                {!DEFAULT_PALETTE.some((d) => d.key === c.key) && (
                  <button onClick={() => setColors(colors.filter((_, j) => j !== i))} aria-label={`Remove ${c.name}`}>
                    <Trash2 className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const n = colors.filter((c) => c.key.startsWith("custom")).length + 1;
              setColors([...colors, { key: `custom_${n}`, name: `Custom ${n}`, hex: "#888888" }]);
            }}
            style={{ fontSize: 12, color: "var(--solar)", display: "flex", alignItems: "center", gap: 5 }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add color
          </button>
        </section>

        {/* Fonts */}
        <section className="sp-card p-5 space-y-4">
          <h2 className="sp-panel-title">Fonts</h2>
          <div>
            <label className="sp-eyebrow block mb-1">Heading</label>
            {fontOptions(headingFont, setHeadingFont)}
          </div>
          <div>
            <label className="sp-eyebrow block mb-1">Body</label>
            {fontOptions(bodyFont, setBodyFont)}
          </div>
          <label
            {...fontDrop.bind}
            data-active={fontDrop.active}
            className="sp-dropzone flex items-center justify-center gap-2 py-3 cursor-pointer"
            style={{ border: "1.5px dashed var(--hairline-strong)", borderRadius: "var(--radius-input)", fontSize: 13, color: "var(--fg-2)" }}
          >
            <Upload className="sp-dropzone__icon w-4 h-4" />
            Upload font file
            <input
              type="file"
              accept={FONT_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                for (const f of Array.from(e.target.files ?? [])) void uploadFont(f);
                e.target.value = "";
              }}
            />
          </label>
          {pendingFonts.map((p) => (
            <div
              key={p.key}
              className={`${p.leaving ? "sp-chip-out" : "sp-chip-in"} flex items-center gap-2.5 px-3 py-2`}
              style={{ border: "1px solid var(--hairline)", borderRadius: "var(--radius-input)", background: "var(--lift)" }}
            >
              <span className="flex-1 min-w-0">
                <span className="block truncate" style={{ fontSize: 12, fontWeight: 500, color: "var(--ink)" }}>
                  {p.name}
                </span>
                {p.done ? (
                  <span className="sp-done-in flex items-center gap-1 mt-1" style={{ fontSize: 10, color: "var(--success)" }}>
                    <Check style={{ width: 11, height: 11 }} />
                    Added
                  </span>
                ) : (
                  <span className="sp-upload-track block mt-1.5">
                    <span className="sp-upload-bar" />
                  </span>
                )}
              </span>
            </div>
          ))}
          {fontAssets.map((a) => (
            <div key={a.id} className="sp-chip-in flex items-center justify-between text-sm">
              <span style={{ color: "var(--foreground)", fontFamily: `"${a.metadata.family ?? a.name}"` }}>
                {a.metadata.family ?? a.name}
              </span>
              <button
                onClick={() => void stores.brandAssets.remove(a.id).then(refresh)}
                aria-label={`Remove ${a.name}`}
              >
                <Trash2 className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>
          ))}
        </section>

        {/* Logos */}
        <section className="sp-card p-5 space-y-4">
          <h2 className="sp-panel-title">Logos</h2>
          <div className="grid grid-cols-3 gap-3">
            {logoAssets.map((a) => (
              <div
                key={a.id}
                className="sp-chip-in relative rounded-xl border p-3 flex items-center justify-center aspect-square"
                style={{ borderColor: a.id === primaryLogoAssetId ? "var(--solar)" : "var(--hairline)", borderRadius: "var(--radius-icon)" }}
              >
                <img src={a.url} alt={a.name} className="max-w-full max-h-full object-contain" />
                <button
                  onClick={() => setPrimaryLogoAssetId(a.id)}
                  title="Make primary"
                  className="absolute top-1.5 right-1.5"
                >
                  <Star
                    className="w-4 h-4"
                    style={{ color: a.id === primaryLogoAssetId ? "var(--amber)" : "var(--hairline-strong)" }}
                    fill={a.id === primaryLogoAssetId ? "currentColor" : "none"}
                  />
                </button>
                <button
                  onClick={() => void stores.brandAssets.remove(a.id).then(refresh)}
                  className="absolute bottom-1.5 right-1.5"
                  aria-label={`Remove ${a.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
                </button>
              </div>
            ))}
            <label
              {...logoDrop.bind}
              data-active={logoDrop.active}
              className="sp-dropzone rounded-xl border-2 border-dashed flex flex-col items-center justify-center aspect-square cursor-pointer gap-1"
              style={{ borderColor: "var(--border)" }}
            >
              <Upload className="sp-dropzone__icon w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
              <span className="sp-eyebrow" style={{ fontSize: 9 }}>Add logo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadLogo(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </section>

        {/* Type styles — the brand rules engine */}
        <section className="sp-card p-5 space-y-4 lg:col-span-2">
          <div>
            <h2 className="sp-panel-title">Type styles &amp; rules (optional)</h2>
            <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 3 }}>
              An opt-in convenience for reuse: apply a saved style to a field if you want, or style
              every field by hand — both are fully locked for end users. Every property a style
              defines follows it across all templates. Unlimited styles.
            </p>
          </div>
          <TypeStylesEditor
            styles={typeStyles}
            colors={colors}
            customFamilies={fontAssets.map((a) => a.metadata.family ?? a.name)}
            onChange={setTypeStyles}
            usageLabelFor={templates ? (key) => usageLabel(bindings.styleUse.get(key)) : undefined}
          />
        </section>

        {/* Design-system import */}
        <section className="sp-card p-5 space-y-4">
          <div>
            <h2 className="sp-panel-title">Import design system</h2>
            <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 3 }}>
              Ingest a design-tokens JSON (colors, type scale) to populate the palette and type
              styles, parse a guidelines.md into suggested rules, or pull styles from a Figma file.
            </p>
          </div>
          <DesignSystemImportPanel
            onImportColors={mergeColors}
            onImportTypeStyles={mergeTypeStyles}
            onImportGuidelines={mergeGuidelines}
          />
        </section>

        {/* Brand guidelines (free-text rules) */}
        <section className="sp-card p-5 space-y-3">
          <div>
            <h2 className="sp-panel-title">Brand guidelines</h2>
            <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 3 }}>
              Do/don't and voice rules for humans building templates. Imported from guidelines.md
              or written here.
            </p>
          </div>
          {guidelines.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--fg-3)" }}>No guidelines yet.</p>
          )}
          {guidelines.map((g, i) => (
            <div key={`${g}-${i}`} className="flex items-start gap-2">
              <span style={{ color: "var(--solar)", fontSize: 12, lineHeight: "1.5" }}>—</span>
              <span className="flex-1" style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.5 }}>{g}</span>
              <button onClick={() => setGuidelines(guidelines.filter((_, j) => j !== i))} aria-label="Remove rule">
                <Trash2 style={{ width: 13, height: 13, color: "var(--fg-3)" }} />
              </button>
            </div>
          ))}
          <input
            className="sp-input"
            placeholder="Add a rule and press Enter…"
            onKeyDown={(e) => {
              const v = (e.target as HTMLInputElement).value.trim();
              if (e.key === "Enter" && v) {
                mergeGuidelines([v]);
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
        </section>

        {/* Live preview */}
        <section className="sp-card p-5 space-y-4">
          <h2 className="sp-panel-title">Preview</h2>
          <BrandPreviewCard
            colors={colors}
            headingFamily={headingFont.family}
            bodyFamily={bodyFont.family}
            logoUrl={logoAssets.find((a) => a.id === primaryLogoAssetId)?.url ?? logoAssets[0]?.url}
          />
          <p style={{ fontSize: 12, color: "var(--fg-3)" }}>
            How your brand applies to your templates and graphics. Save to apply everywhere.
          </p>
        </section>
      </div>
    </div>
  );
}

interface BrandPreviewCardProps {
  colors: BrandColor[];
  headingFamily: string;
  bodyFamily: string;
  logoUrl?: string;
}

function BrandPreviewCard({ colors, headingFamily, bodyFamily, logoUrl }: BrandPreviewCardProps) {
  const hex = (key: string, fallback: string) => colors.find((c) => c.key === key)?.hex ?? fallback;
  return (
    <div className="overflow-hidden" style={{ border: "1px solid var(--hairline)", borderRadius: "var(--radius-card-sm)" }}>
      <div className="px-5 py-4 flex items-center gap-3" style={{ background: hex("primary", "#2F3B4C") }}>
        {logoUrl && <img src={logoUrl} alt="" className="h-6 w-auto" />}
        <span className="text-white font-extrabold uppercase text-sm" style={{ fontFamily: `"${headingFamily}", sans-serif` }}>
          Sample Header
        </span>
      </div>
      <div className="p-5" style={{ background: hex("background", "#F6F7F9") }}>
        <p className="font-extrabold text-lg mb-1" style={{ color: hex("text", "#1A1F26"), fontFamily: `"${headingFamily}", sans-serif` }}>
          Congratulations, Jordan!
        </p>
        <p className="text-sm mb-3" style={{ color: hex("text", "#1A1F26"), fontFamily: `"${bodyFamily}", sans-serif` }}>
          Five incredible years — thank you for everything you do.
        </p>
        <span
          className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md"
          style={{ background: hex("accent", "#C9A227"), color: "#fff" }}
        >
          Accent chip
        </span>
      </div>
    </div>
  );
}
