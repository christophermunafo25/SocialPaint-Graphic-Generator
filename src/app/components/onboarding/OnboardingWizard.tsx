import React, { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Upload } from "lucide-react";
import type { BrandColor, FontRef } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { useRouter } from "../../router";
import { DEFAULT_PALETTE, DEFAULT_TYPE_STYLES } from "@/lib/theme";
import { GOOGLE_FONTS, loadGoogleFonts } from "@/lib/render/fonts";
import { FONT_ACCEPT, inspectFontFile } from "@/lib/brand/fontUpload";
import { useFileDrop } from "@/lib/useFileDrop";
import { ColorControl } from "../ColorControl";

/** First-run onboarding: walks a user from an empty database to a themed,
 * ready-to-use company workspace. Also reachable any time via "Create
 * company" — every new client starts from this identical blank slate.
 * Everything set here is editable later in Brand Studio. */

const STEPS = ["Company", "Colors", "Fonts", "Logo"] as const;

interface PendingFont {
  file: File;
  family: string;
  use: "heading" | "body" | "none";
}

export function OnboardingWizard({ firstRun }: { firstRun: boolean }) {
  const { setCompany, setRole, refresh } = useAuth();
  const { refresh: refreshBrand } = useBrand();
  const { navigate } = useRouter();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [colors, setColors] = useState<BrandColor[]>(DEFAULT_PALETTE);
  const [headingGoogle, setHeadingGoogle] = useState("Montserrat");
  const [bodyGoogle, setBodyGoogle] = useState("Inter");
  const [pendingFonts, setPendingFonts] = useState<PendingFont[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const slug = useMemo(
    () => companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    [companyName],
  );

  const canNext = step === 0 ? companyName.trim().length > 1 : true;

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      const company = await stores.companies.create({ name: companyName.trim(), slug });

      // Uploaded custom fonts become brand assets; chosen ones drive the kit.
      let headingFont: FontRef = { source: "google", family: headingGoogle };
      let bodyFont: FontRef = { source: "google", family: bodyGoogle };
      for (const pf of pendingFonts) {
        const check = await inspectFontFile(pf.file);
        if (!check.ok) continue; // validated at add time; belt-and-braces
        const asset = await stores.brandAssets.upload(company.id, "font", pf.file, {
          ...check.metadata,
          family: pf.family,
        });
        const ref: FontRef = { source: "custom", family: pf.family, assetId: asset.id };
        if (pf.use === "heading") headingFont = ref;
        if (pf.use === "body") bodyFont = ref;
      }
      loadGoogleFonts([headingFont, bodyFont].filter((f) => f.source === "google").map((f) => f.family));

      let primaryLogoAssetId: string | undefined;
      if (logoFile) {
        const asset = await stores.brandAssets.upload(company.id, "logo", logoFile);
        primaryLogoAssetId = asset.id;
      }

      await stores.brandKits.upsert(company.id, {
        colors,
        typeStyles: DEFAULT_TYPE_STYLES,
        guidelines: [],
        headingFont,
        bodyFont,
        primaryLogoAssetId,
      });

      // Real auth already created the admin membership server-side: under
      // RLS, stores.companies.create only works via the security-definer
      // create_company_with_admin RPC (company + admin membership, atomic).
      // setRole is the dev switcher and a no-op under real auth.
      await refresh();
      await setCompany(company.id);
      setRole("admin");
      await refreshBrand();
      navigate({ name: "adminTemplates" });
    } catch (e) {
      console.error("Onboarding failed", e);
      setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-canvas)" }}>
      <div className="w-full max-w-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-card)" }}>
        {/* Header + progress */}
        <div className="sp-mesh px-8 pt-8 pb-6">
          <p className="sp-eyebrow mb-1" style={{ color: "var(--brand-surface-fg)" }}>
            {firstRun ? "Welcome" : "New company"}
          </p>
          {/* Ink on the brand surface — anything on Volt/Aqua is Ink, no exceptions. */}
          <h1 className="sp-hero-title" style={{ color: "var(--brand-surface-fg)" }}>
            {firstRun ? "Set up your brand portal" : "Create a company"}
          </h1>
          <div className="flex gap-1.5 mt-5">
            {STEPS.map((label, i) => (
              <div key={label} className="flex-1">
                <div
                  className="h-1 rounded-full"
                  style={{ background: i <= step ? "var(--brand-surface-fg)" : "color-mix(in srgb, var(--brand-surface-fg) 30%, transparent)" }}
                />
                <p className="sp-eyebrow mt-1.5" style={{ fontSize: 9, color: "color-mix(in srgb, var(--brand-surface-fg) 75%, transparent)" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-8 py-7 space-y-5 min-h-[320px]">
          {step === 0 && (
            <StepCompany name={companyName} slug={slug} onChange={setCompanyName} />
          )}
          {step === 1 && <StepColors colors={colors} onChange={setColors} />}
          {step === 2 && (
            <StepFonts
              headingGoogle={headingGoogle}
              bodyGoogle={bodyGoogle}
              setHeadingGoogle={setHeadingGoogle}
              setBodyGoogle={setBodyGoogle}
              pendingFonts={pendingFonts}
              setPendingFonts={setPendingFonts}
              onError={setError}
            />
          )}
          {step === 3 && (
            <StepLogo
              preview={logoPreview}
              onPick={(file) => {
                setLogoFile(file);
                const reader = new FileReader();
                reader.onload = () => setLogoPreview(reader.result as string);
                reader.readAsDataURL(file);
              }}
            />
          )}
          {error && (
            <p className="text-sm px-4 py-3" data-radius-card style={{ background: "var(--danger-wash)", color: "var(--destructive)" }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer nav */}
        <div className="px-8 pb-8 flex items-center justify-between">
          <button
            onClick={() => (step === 0 ? navigate({ name: "portal" }) : setStep(step - 1))}
            disabled={firstRun && step === 0}
            className="flex items-center gap-1.5 disabled:opacity-0" style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canNext}
              className="sp-btn sp-btn-primary" style={{ padding: "10px 20px" }}
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => void finish()}
              disabled={saving}
              className="sp-btn sp-btn-primary" style={{ padding: "10px 20px" }}
            >
              <Check className="w-4 h-4" />
              {saving ? "Creating…" : "Create workspace"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepCompany({ name, slug, onChange }: { name: string; slug: string; onChange(v: string): void }) {
  return (
    <div className="space-y-3">
      <h2 className="sp-panel-title" style={{ fontSize: "var(--type-cardtitle-size)" }}>Company name</h2>
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
        The tenant everything belongs to — templates, brand kit, and usage stay private to it.
      </p>
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Acme Senior Living"
        className="sp-input"
      />
      {slug && (
        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          Workspace id: <span className="font-mono">{slug}</span>
        </p>
      )}
    </div>
  );
}

function StepColors({ colors, onChange }: { colors: BrandColor[]; onChange(c: BrandColor[]): void }) {
  const set = (i: number, patch: Partial<BrandColor>) =>
    onChange(colors.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-3">
      <h2 className="sp-panel-title" style={{ fontSize: "var(--type-cardtitle-size)" }}>Brand colors</h2>
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
        Sensible defaults — override them with your palette. Template text colors are always picked from these, keeping every graphic on-brand.
      </p>
      <div className="space-y-2">
        {colors.map((c, i) => (
          <div key={c.key} className="flex items-center gap-3">
            <ColorControl
              ariaLabel={`${c.name} color`}
              value={c.hex}
              onChange={(hex) => set(i, { hex })}
              /* The palette is being defined here — there is nothing to
                 quick-select from yet. */
              brandSwatches={false}
            />
            <span className="text-sm flex-1" style={{ color: "var(--foreground)" }}>{c.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FontSelect({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  return (
    <label className="block">
      <span className="sp-eyebrow">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          loadGoogleFonts([e.target.value]);
          onChange(e.target.value);
        }}
        className="sp-input mt-1"
      >
        {GOOGLE_FONTS.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
    </label>
  );
}

interface StepFontsProps {
  headingGoogle: string;
  bodyGoogle: string;
  setHeadingGoogle(v: string): void;
  setBodyGoogle(v: string): void;
  pendingFonts: PendingFont[];
  setPendingFonts: React.Dispatch<React.SetStateAction<PendingFont[]>>;
  onError(e: string | null): void;
}

function StepFonts(props: StepFontsProps) {
  const addFonts = async (files: File[]) => {
    props.onError(null);
    for (const file of files) {
      const check = await inspectFontFile(file);
      if (!check.ok) {
        props.onError(check.error);
        continue;
      }
      props.setPendingFonts((prev) => [
        ...prev,
        { file, family: check.metadata.family ?? file.name, use: "none" },
      ]);
    }
  };
  const drop = useFileDrop(addFonts);
  return (
    <div className="space-y-4">
      <h2 className="sp-panel-title" style={{ fontSize: "var(--type-cardtitle-size)" }}>Fonts</h2>
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
        Pick from Google Fonts, or upload your own brand font files (.woff2, .woff, .ttf, .otf) and assign them.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <FontSelect label="Heading font" value={props.headingGoogle} onChange={props.setHeadingGoogle} />
        <FontSelect label="Body font" value={props.bodyGoogle} onChange={props.setBodyGoogle} />
      </div>
      <div>
        <label
          {...drop.bind}
          data-active={drop.active}
          className="sp-dropzone flex items-center justify-center gap-2 py-3.5 cursor-pointer"
          style={{ border: "1.5px dashed var(--border-strong)", borderRadius: "var(--radius-control)", fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}
        >
          <Upload className="sp-dropzone__icon w-4 h-4" />
          Upload custom font
          <input
            type="file"
            accept={FONT_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              addFonts(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </label>
        {props.pendingFonts.map((pf, i) => (
          <div key={`${pf.file.name}-${i}`} className="sp-chip-in flex items-center gap-2 mt-2">
            <span className="text-sm flex-1 truncate" style={{ color: "var(--foreground)" }}>{pf.family}</span>
            <select
              value={pf.use}
              onChange={(e) =>
                props.setPendingFonts((prev) =>
                  prev.map((p, j) => (j === i ? { ...p, use: e.target.value as PendingFont["use"] } : p)),
                )
              }
              className="sp-input" style={{ width: "auto", padding: "5px 8px", fontSize: "var(--type-caption-size)" }}
            >
              <option value="none">Library only</option>
              <option value="heading">Use as heading</option>
              <option value="body">Use as body</option>
            </select>
            <button
              onClick={() => props.setPendingFonts((prev) => prev.filter((_, j) => j !== i))}
              aria-label="Remove font"
            >
              <Trash2 className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepLogo({ preview, onPick }: { preview: string | null; onPick(f: File): void }) {
  const drop = useFileDrop((files) => {
    if (files[0]) onPick(files[0]);
  });
  return (
    <div className="space-y-3">
      <h2 className="sp-panel-title" style={{ fontSize: "var(--type-cardtitle-size)" }}>Logo</h2>
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
        Optional now — you can add more logos later in Brand Studio.
      </p>
      <label
        {...drop.bind}
        data-active={drop.active}
        className="sp-dropzone flex flex-col items-center justify-center gap-3 py-8 cursor-pointer"
        style={{ border: "1.5px dashed var(--border-strong)", borderRadius: "var(--radius-card-sm)" }}
      >
        {preview ? (
          <img src={preview} alt="Logo preview" className="max-h-20 max-w-[240px] object-contain" />
        ) : (
          <Upload className="sp-dropzone__icon w-6 h-6" style={{ color: "var(--muted-foreground)" }} />
        )}
        <span style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}>
          {preview ? "Replace logo" : "Upload logo (PNG or SVG)"}
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }}
        />
      </label>
    </div>
  );
}

