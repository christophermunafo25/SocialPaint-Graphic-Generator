import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Trash2, Upload } from "lucide-react";
import type { BrandColor, FontRef } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { useRouter } from "../../router";
import { DEFAULT_PALETTE, DEFAULT_TYPE_STYLES } from "@/lib/theme";
import { GOOGLE_FONTS, loadGoogleFonts } from "@/lib/render/fonts";
import { FONT_ACCEPT, inspectFontFile } from "@/lib/brand/fontUpload";
import { useFileDrop } from "@/lib/useFileDrop";
import { useMotionTokens } from "@/lib/motionTokens";
import { ColorControl } from "../ColorControl";
import { BrandMark } from "../BrandMark";
import { PreAppShell } from "../PreAppShell";

/** First-run onboarding: walks a user from an empty database to a themed,
 * ready-to-use company workspace. Also reachable any time via "Create
 * company" — every new client starts from this identical blank slate.
 * Everything set here is editable later in Brand Studio.
 *
 * Four frames (Figma 154:1576, 154:1654, 158:202, 158:267) in the pre-app
 * shell's wide card: one rhythm — intro, description, stepper, body,
 * footer — where only the body changes between steps. The body crossfades
 * with a short translate in the direction of travel on --dur-panel; the
 * chrome around it persists and does not re-animate. Focus lands on the
 * headline after each move so it is never lost.
 *
 * The four steps and finish() are unchanged — this is a rehousing, not a
 * rewrite of the setup logic. */

const STEPS = ["Company", "Brand colors", "Fonts", "Logo"] as const;

/** Per-step headlines carry the firstRun distinction that the old eyebrow
 * held ("Welcome" versus "New company"): a first admin is asked about their
 * brand, a signed-in user creating another company is asked about that
 * company. */
const HEADLINES = {
  firstRun: [
    "What is the name of your brand?",
    "What colors are in your palette?",
    "What fonts are we working with?",
    "Let’s add your logos!",
  ],
  inApp: [
    "Name the new company",
    "What colors are in its palette?",
    "What fonts does it use?",
    "Add its logo",
  ],
} as const;

const DESCRIPTIONS: readonly (string | null)[] = [
  null,
  "Sensible defaults — override them with your palette. Template text colors are always picked from these, keeping every graphic on-brand.",
  "Pick from Google Fonts, or upload your own brand font files (.woff2, .woff, .ttf, .otf) and assign them.",
  "Optional now — you can add more logos later in Brand Studio.",
];

interface PendingFont {
  file: File;
  family: string;
  use: "heading" | "body" | "none";
}

export function OnboardingWizard({ firstRun }: { firstRun: boolean }) {
  const { setCompany, setRole, refresh } = useAuth();
  const { refresh: refreshBrand } = useBrand();
  const { navigate } = useRouter();
  const m = useMotionTokens();

  const [step, setStepState] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
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
    () =>
      companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    [companyName],
  );

  const canNext = step === 0 ? companyName.trim().length > 1 : true;

  const setStep = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStepState(next);
  };

  // Focus follows the step: the headline takes it after every move, so a
  // keyboard user is never left on a control that just unmounted.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) headingRef.current?.focus({ preventScroll: true });
    else mounted.current = true;
  }, [step]);

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
      loadGoogleFonts(
        [headingFont, bodyFont].filter((f) => f.source === "google").map((f) => f.family),
      );

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

  // The only way out for a signed-in user: Cancel at step 0 on the in-app
  // path navigates to the portal; Back otherwise. Hidden (and disabled)
  // only when firstRun && step === 0, where there is nowhere to go — and
  // on that step the footer itself is gone, since a single question should
  // look like one.
  const exitHidden = firstRun && step === 0;
  const headline = (firstRun ? HEADLINES.firstRun : HEADLINES.inApp)[step];
  const description = DESCRIPTIONS[step];

  const variants = {
    enter: (d: 1 | -1) => ({ opacity: 0, y: 12 * d }),
    center: { opacity: 1, y: 0 },
    exit: (d: 1 | -1) => ({ opacity: 0, y: -12 * d }),
  };

  return (
    <PreAppShell layout="solo" width="wide" tone={firstRun ? "dark" : "app"}>
      <div className="sp-gate__intro">
        {firstRun && <BrandMark width={55} />}
        <h1 ref={headingRef} tabIndex={-1} className="sp-hero-title">
          {headline}
        </h1>
      </div>
      <p className="sp-gate__desc">{description ?? ""}</p>
      <Stepper step={step} pulse={m.panel} ease={m.ease} />

      <div className="sp-gate__body">
        <AnimatePresence mode="popLayout" custom={direction} initial={false}>
          <motion.div
            key={step}
            className="sp-gate__step-body"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: m.panel, ease: m.ease }}
          >
            {step === 0 && (
              <StepCompany
                name={companyName}
                slug={slug}
                onChange={setCompanyName}
                onSubmit={() => canNext && setStep(1)}
              />
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
          </motion.div>
        </AnimatePresence>
        {/* finish() can fail after creating the company; the message stays
            in this reserved line until the next attempt clears it. */}
        <div className="sp-gate__status" role="alert" aria-live="assertive">
          {error && <p className="sp-gate__error">{error}</p>}
        </div>
      </div>

      {!exitHidden && (
        <nav className="sp-gate__nav" aria-label="Setup navigation">
          <button
            type="button"
            className="sp-gate__back"
            onClick={() => (step === 0 ? navigate({ name: "portal" }) : setStep(step - 1))}
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {step > 0 && step < STEPS.length - 1 && (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canNext}
              className="sp-gate__cta"
            >
              Continue
              <ArrowRight className="w-4 h-4" aria-hidden />
            </button>
          )}
          {step === STEPS.length - 1 && (
            <button
              type="button"
              onClick={() => void finish()}
              disabled={saving}
              className="sp-gate__cta"
            >
              {saving ? "Creating…" : "Create workspace"}
              <Check className="w-4 h-4" aria-hidden />
            </button>
          )}
        </nav>
      )}
    </PreAppShell>
  );
}

/** Four named steps. The circle colours transition in CSS on --dur-state;
 * a step completing also pulses once on --dur-panel, the one moment of
 * progress feedback in the flow. */
function Stepper({
  step,
  pulse,
  ease,
}: {
  step: number;
  pulse: number;
  ease: [number, number, number, number];
}) {
  return (
    <ol className="sp-gate__steps" aria-label="Setup steps">
      {STEPS.map((label, i) => {
        const state = i < step ? "done" : i === step ? "current" : "todo";
        return (
          <li
            key={label}
            className="sp-gate__step"
            data-state={state}
            aria-current={i === step ? "step" : undefined}
          >
            <motion.span
              className="sp-gate__step-dot"
              aria-hidden
              animate={state === "done" ? { scale: [1, 1.18, 1] } : { scale: 1 }}
              transition={{ duration: pulse, ease }}
            >
              {i + 1}
            </motion.span>
            <span className="sp-gate__step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function StepCompany({
  name,
  slug,
  onChange,
  onSubmit,
}: {
  name: string;
  slug: string;
  onChange(v: string): void;
  onSubmit(): void;
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Acme Studios"
        aria-label="Company name"
        className="sp-input sp-input-lg"
      />
      {slug && (
        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          Workspace id: <span className="font-mono">{slug}</span>
        </p>
      )}
    </form>
  );
}

function StepColors({
  colors,
  onChange,
}: {
  colors: BrandColor[];
  onChange(c: BrandColor[]): void;
}) {
  const set = (i: number, patch: Partial<BrandColor>) =>
    onChange(colors.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
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
          <span className="text-sm flex-1" style={{ color: "var(--foreground)" }}>
            {c.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function FontSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
}) {
  return (
    <label className="block">
      <span className="sp-eyebrow">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          loadGoogleFonts([e.target.value]);
          onChange(e.target.value);
        }}
        className="sp-input sp-input-lg mt-1"
      >
        {GOOGLE_FONTS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
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
  const drop = useFileDrop((files) => void addFonts(files));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FontSelect
          label="Heading font"
          value={props.headingGoogle}
          onChange={props.setHeadingGoogle}
        />
        <FontSelect label="Body font" value={props.bodyGoogle} onChange={props.setBodyGoogle} />
      </div>
      <div>
        <label
          {...drop.bind}
          data-active={drop.active}
          className="sp-dropzone flex items-center justify-center gap-2 py-3.5 cursor-pointer"
          style={{
            border: "1.5px dashed var(--border-strong)",
            borderRadius: "var(--radius-control)",
            fontSize: "var(--type-label-size)",
            color: "var(--text-secondary)",
          }}
        >
          <Upload className="sp-dropzone__icon w-4 h-4" />
          Upload custom font
          <input
            type="file"
            accept={FONT_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              void addFonts(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </label>
        {props.pendingFonts.map((pf, i) => (
          <div
            key={`${pf.file.name}-${i}`}
            className="sp-chip-in flex flex-wrap items-center gap-2 mt-2"
          >
            <span
              className="text-sm flex-1 truncate"
              style={{ color: "var(--foreground)", minWidth: 120 }}
            >
              {pf.family}
            </span>
            <select
              value={pf.use}
              aria-label={`Use for ${pf.family}`}
              onChange={(e) =>
                props.setPendingFonts((prev) =>
                  prev.map((p, j) =>
                    j === i ? { ...p, use: e.target.value as PendingFont["use"] } : p,
                  ),
                )
              }
              className="sp-input"
              style={{ width: "auto", padding: "5px 8px", fontSize: "var(--type-caption-size)" }}
            >
              <option value="none">Library only</option>
              <option value="heading">Use as heading</option>
              <option value="body">Use as body</option>
            </select>
            <button
              type="button"
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
    <label
      {...drop.bind}
      data-active={drop.active}
      className="sp-dropzone flex flex-col items-center justify-center gap-3 py-8 cursor-pointer"
      style={{
        border: "1.5px dashed var(--border-strong)",
        borderRadius: "var(--radius-card-sm)",
      }}
    >
      {preview ? (
        <img src={preview} alt="Logo preview" className="max-h-20 max-w-[240px] object-contain" />
      ) : (
        <Upload
          className="sp-dropzone__icon w-6 h-6"
          style={{ color: "var(--muted-foreground)" }}
        />
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
  );
}
