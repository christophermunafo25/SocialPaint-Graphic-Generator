import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Book,
  Box,
  Building,
  Calendar,
  Ellipsis,
  Globe,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Role, TemplateSchema } from "@/lib/types";
import {
  EMPTY_ANSWERS,
  FIRST_UP,
  HEARD_FROM,
  MAKERS,
  POST_PLATFORMS,
  ROLE_LABEL,
  SETUP_FOR,
  TEAM_SIZE,
  firstName,
  listPhrase,
  platformPhrase,
  profileFrom,
  progressFor,
  validateStep,
  type Answers,
  type FirstUp,
  type JobRole,
  type Maker,
  type PostPlatform,
  type SetupFor,
  type StepErrors,
  type StepId,
  type TeamSize,
} from "@/lib/onboarding/answers";
import {
  EMPTY_BRAND,
  MAX_COLORS,
  addedColor,
  brandFromPull,
  paletteFrom,
  type BrandAnswers,
} from "@/lib/onboarding/prefill";
import { slugFor, type BrandDraft } from "@/lib/onboarding/service";
import { GOOGLE_FONTS, loadGoogleFonts } from "@/lib/render/fonts";
import { normalizeWebsite } from "@/lib/companyWebsite";
import { useMotionTokens } from "@/lib/motionTokens";
import { PreAppShell } from "../PreAppShell";
import { ColorControl } from "../ColorControl";
import { TemplateThumbnail } from "../TemplateThumbnail";
import {
  Button,
  IconButton,
  Input,
  OptionCheckboxGroup,
  OptionRadioGroup,
  PlatformLogo,
  Select,
  Status,
  Upload,
  type OptionTileOption,
} from "../primitives";
import { AddColorButton, ProgressSegments, Question, WorkspacePreview } from "./pieces";
import type { CreatedWorkspace, OnboardingServices } from "./services";

const ROLE_ICON: Record<JobRole, LucideIcon> = {
  marketing: Sparkles,
  design: Pencil,
  founder: Building,
  people: Users,
  events: Calendar,
  sales: BarChart3,
  agency: Box,
  other: Ellipsis,
};
const SETUP_ICON: Record<SetupFor, LucideIcon> = {
  company: Building,
  clients: Box,
  locations: MapPin,
  just_me: User,
};
const FIRST_UP_ICON: Record<FirstUp, LucideIcon> = {
  hiring: Users,
  events: Calendar,
  speakers: Sparkles,
  product: Box,
  stories: Book,
  team: User,
  webinars: Globe,
  other: Ellipsis,
};

const options = <T extends string>(
  labels: Record<T, string>,
  icons?: Record<T, LucideIcon>,
): OptionTileOption<T>[] =>
  (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
    icon: icons?.[value],
  }));

const ROLE_OPTIONS = options(ROLE_LABEL, ROLE_ICON);
const SETUP_OPTIONS: OptionTileOption<SetupFor>[] = (Object.keys(SETUP_FOR) as SetupFor[]).map(
  (value) => ({ value, ...SETUP_FOR[value], icon: SETUP_ICON[value] }),
);
const SIZE_OPTIONS = options(TEAM_SIZE);
const MAKER_OPTIONS = options(MAKERS);
const FIRST_UP_OPTIONS = options(FIRST_UP, FIRST_UP_ICON);
const PLATFORM_OPTIONS: OptionTileOption<PostPlatform>[] = (
  Object.keys(POST_PLATFORMS) as PostPlatform[]
).map((value) => ({
  value,
  label: POST_PLATFORMS[value],
  icon: <PlatformLogo platform={value} size={16} />,
}));
const HEARD_OPTIONS = HEARD_FROM.map((h) => ({ value: h, label: h }));
const FONT_OPTIONS = (extra: string[]) =>
  [...new Set([...extra, ...GOOGLE_FONTS])].map((f) => ({ value: f, label: f }));

const DEFAULT_HEADING = "Montserrat";
const DEFAULT_BODY = "Inter";

interface InviteRow {
  id: number;
  email: string;
  role: Role;
  error?: string;
}
const MAX_INVITES = 10;
const ROLE_CHOICES = [
  { value: "admin" as const, label: "Admin" },
  { value: "member" as const, label: "Member" },
];

type PullStatus = "waiting" | "looking" | "found" | "notFound";

export interface OnboardingFlowProps {
  services: OnboardingServices;
  /** The in-app "Create company" path: the person is known, so it starts at
   * Your team (D19). */
  inApp?: boolean;
  /** /dev/onboarding: start on a step with sample answers. */
  initial?: {
    step: StepId;
    answers?: Partial<Answers>;
    brand?: Partial<BrandAnswers>;
    created?: CreatedWorkspace;
    starters?: TemplateSchema[];
    /** Pulling your brand mid-pull, as the frame draws it (259:583). */
    midPull?: boolean;
  };
}

/** Create account (Figma 257:2, PHASE-8B-ONBOARDING-SCREENS.md): About you,
 * Set up for, Your team, First up, Website (or Add your brand), Pulling
 * your brand, Your brand, Invite your team, Workspace ready. Light, on the
 * auth layout beside the workspace preview.
 *
 * Every answer lives in this component's state until Your brand's "Looks
 * good", which creates the workspace, its brand and its starters in one go
 * (D12), so leaving earlier leaves nothing behind. The rules run on
 * Continue (D15); the person's name and role save with the workspace. */
export function OnboardingFlow({ services, inApp = false, initial }: OnboardingFlowProps) {
  const m = useMotionTokens();
  const [step, setStep] = useState<StepId>(initial?.step ?? (inApp ? "team" : "about"));
  const [answers, setAnswers] = useState<Answers>({ ...EMPTY_ANSWERS, ...initial?.answers });
  const [brand, setBrand] = useState<BrandAnswers>({ ...EMPTY_BRAND, ...initial?.brand });
  const [extraFonts, setExtraFonts] = useState<string[]>([]);
  const [branch, setBranch] = useState<"website" | "manual">("website");
  const [pullNote, setPullNote] = useState<string | null>(null);
  const [pull, setPull] = useState<Record<"logo" | "colors" | "fonts", PullStatus>>(
    initial?.midPull
      ? { logo: "found", colors: "looking", fonts: "waiting" }
      : { logo: "looking", colors: "waiting", fonts: "waiting" },
  );
  const [errors, setErrors] = useState<StepErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedWorkspace | null>(initial?.created ?? null);
  const [brandDirty, setBrandDirty] = useState(false);
  const [starters, setStarters] = useState<TemplateSchema[]>(initial?.starters ?? []);
  const [invites, setInvites] = useState<InviteRow[]>([{ id: 1, email: "", role: "member" }]);
  const nextInviteId = useRef(2);

  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const ids = {
    name: useId(),
    role: useId(),
    heard: useId(),
    company: useId(),
    size: useId(),
    makers: useId(),
    firstUp: useId(),
    platforms: useId(),
    website: useId(),
    logo: useId(),
    colors: useId(),
    fonts: useId(),
    invites: useId(),
  };

  // Focus follows the step: the title takes it after every move, so a
  // keyboard user is never left on a control that just unmounted.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) titleRef.current?.focus({ preventScroll: true });
    else mounted.current = true;
  }, [step]);

  useEffect(() => {
    loadGoogleFonts([brand.headingFont, brand.bodyFont].filter((f): f is string => !!f));
  }, [brand.headingFont, brand.bodyFont]);

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const editBrand = (patch: Partial<BrandAnswers>) => {
    setBrand((b) => ({ ...b, ...patch }));
    setBrandDirty(true);
  };

  const go = (next: StepId) => {
    setErrors({});
    setFailure(null);
    setStep(next);
  };

  /** Runs the step's rules; on a miss, shows them and focuses the first. */
  const check = (s: StepId): boolean => {
    const found = validateStep(s, answers);
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      requestAnimationFrame(() => focusFirstError(formRef.current));
      return false;
    }
    return true;
  };

  // ── Pulling your brand (D16) ──
  const startPull = async () => {
    const site = normalizeWebsite(answers.website) ?? answers.website.trim();
    setBranch("website");
    setPullNote(null);
    setPull({ logo: "looking", colors: "waiting", fonts: "waiting" });
    go("pulling");
    const beat = (ms: number) => new Promise((r) => setTimeout(r, m.reveal ? ms : 0));
    try {
      if (!services.pullAvailable) throw new Error("The brand pull isn't available here.");
      const result = await services.pullBrand(site);
      const pulled = await brandFromPull(result);
      setPull((p) => ({ ...p, logo: pulled.found.logo ? "found" : "notFound", colors: "looking" }));
      await beat(450);
      setPull((p) => ({
        ...p,
        colors: pulled.found.colors ? "found" : "notFound",
        fonts: "looking",
      }));
      await beat(450);
      setPull((p) => ({ ...p, fonts: pulled.found.fonts ? "found" : "notFound" }));
      setBrand({
        colors: pulled.colors,
        headingFont: pulled.headingFont,
        bodyFont: pulled.bodyFont,
        logo: pulled.logo,
        logoPreview: pulled.logoPreview,
      });
      setExtraFonts(pulled.extraFonts);
      setBrandDirty(true);
      await beat(600);
      go("brand");
    } catch (e) {
      console.error("Brand pull failed", e);
      setBranch("manual");
      setPullNote("We couldn’t read that site. Add your brand here instead.");
      go("addBrand");
    }
  };

  // ── Your brand's "Looks good": create, or save the edit (D12) ──
  const brandDraft = (): BrandDraft => ({
    colors: paletteFrom(brand.colors),
    headingGoogle: brand.headingFont ?? DEFAULT_HEADING,
    bodyGoogle: brand.bodyFont ?? DEFAULT_BODY,
    fonts: [],
    logo: brand.logo,
  });

  const confirmBrand = async () => {
    setBusy(true);
    setFailure(null);
    try {
      if (!created) {
        const site = normalizeWebsite(answers.website) ?? undefined;
        const made = await services.createWorkspace({
          name: answers.companyName,
          slug: slugFor(answers.companyName),
          website: branch === "website" ? site : undefined,
          profile: profileFrom(answers),
          brand: brandDraft(),
        });
        if (!inApp) await services.savePerson({ name: answers.name, role: answers.role });
        setCreated(made);
        setStarters(await services.listStarters(made.companyId).catch(() => []));
        setBrandDirty(false);
        // The logo is uploaded now; a later edit uploads only a new one.
        setBrand((b) => ({ ...b, logo: null }));
      } else if (brandDirty) {
        const kit = await services.updateBrand(created, brandDraft());
        setCreated({ ...created, kit, logoAssetId: kit.primaryLogoAssetId });
        setBrandDirty(false);
        setBrand((b) => ({ ...b, logo: null }));
      }
      go("invite");
    } catch (e) {
      console.error("Creating the workspace failed", e);
      setFailure("Something went wrong saving your workspace. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // ── Invite your team (D17) ──
  const sendInvites = async () => {
    if (!created) return;
    const rows = invites.map((r) => ({ ...r, error: undefined as string | undefined }));
    let ok = true;
    for (const r of rows) {
      const email = r.email.trim();
      if (!email) continue;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        r.error = "Enter a valid email address.";
        ok = false;
      }
    }
    if (!ok) {
      setInvites(rows);
      requestAnimationFrame(() => focusFirstError(formRef.current));
      return;
    }
    setBusy(true);
    for (const r of rows) {
      const email = r.email.trim();
      if (!email || r.error) continue;
      try {
        await services.invite(created.companyId, email, r.role);
        r.email = "";
      } catch (e) {
        console.error("Invite failed", e);
        r.error = "That invite didn’t go. Try again, or invite them later from Settings.";
        ok = false;
      }
    }
    setBusy(false);
    const left = rows.filter((r) => r.email.trim() || r.error);
    setInvites(left.length ? left : [{ id: nextInviteId.current++, email: "", role: "member" }]);
    if (ok) go("ready");
    else requestAnimationFrame(() => focusFirstError(formRef.current));
  };

  const enter = async (to: Parameters<OnboardingServices["enter"]>[1]) => {
    if (!created) return;
    setBusy(true);
    try {
      await services.enter(created.companyId, to);
    } catch (e) {
      console.error("Opening the workspace failed", e);
      setFailure("Something went wrong opening your workspace. Try again.");
      setBusy(false);
    }
  };

  // ── The panel (D14) ──
  const preview = useMemo(() => {
    const sizeDetail = answers.teamSize
      ? answers.teamSize === "just_me"
        ? TEAM_SIZE.just_me
        : `${TEAM_SIZE[answers.teamSize]} people`
      : undefined;
    const workspaceDetail = [answers.setupFor && SETUP_FOR[answers.setupFor].label, sizeDetail]
      .filter(Boolean)
      .join(" · ");
    const showBrand = brand.colors.length > 0 || !!brand.logoPreview || !!created;
    return {
      person: answers.name.trim()
        ? { name: answers.name.trim(), detail: answers.role && ROLE_LABEL[answers.role] }
        : undefined,
      workspace: answers.companyName.trim()
        ? { name: answers.companyName.trim(), detail: workspaceDetail || undefined }
        : undefined,
      firstUp: answers.firstUp.length
        ? {
            title: listPhrase(answers.firstUp.map((f) => FIRST_UP[f])),
            detail: platformPhrase(answers.platforms) || undefined,
          }
        : undefined,
      brand: showBrand
        ? {
            logoUrl: brand.logoPreview ?? undefined,
            colors: brand.colors.map((c) => c.hex),
            font: brand.headingFont,
          }
        : undefined,
      templates: starters
        .slice(0, 3)
        .map((t) => <TemplateThumbnail key={t.id} template={t} brandKit={created?.kit ?? null} />),
    };
  }, [answers, brand, starters, created]);

  const progress = progressFor(step, inApp);
  const companyName = answers.companyName.trim() || "your workspace";
  const domain = normalizeWebsite(answers.website) ?? answers.website.trim();

  const back = (to: StepId) => (
    <Button kind="neutral" size="lg" onClick={() => go(to)}>
      Back
    </Button>
  );
  const primary = (label: string, onClick?: () => void) => (
    <Button
      kind="primary"
      size="lg"
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
    >
      {label}
    </Button>
  );
  const textLink = (label: string, onClick: () => void) => (
    <button type="button" className="ui-reset ui-ring t-label-m sp-auth-link" onClick={onClick}>
      {label}
    </button>
  );

  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    editBrand({ logo: file, logoPreview: URL.createObjectURL(file) });
  };
  const logoInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/png,image/jpeg,image/svg+xml,image/webp"
      hidden
      onChange={(e) => {
        pickLogo(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  const colorEditor = (shape: "dot" | "card") => (
    <div className="sp-onb-colors" data-cards={shape === "card" || undefined}>
      {brand.colors.map((c, i) => (
        <span
          key={`${c.hex}-${i}`}
          className={shape === "dot" ? "sp-onb-dot" : "sp-onb-color-card"}
        >
          <ColorControl
            value={c.hex}
            onChange={(hex) =>
              editBrand({ colors: brand.colors.map((x, j) => (j === i ? { ...x, hex } : x)) })
            }
            hexField={false}
            brandSwatches={false}
            ariaLabel={`${c.name}, ${c.hex}`}
            swatchStyle={
              shape === "dot"
                ? { width: 40, height: 40, borderRadius: "var(--radius-pill)" }
                : { width: "100%", height: 48, borderRadius: "var(--radius-control)" }
            }
          />
          {shape === "card" && <span className="t-mono-s sp-onb-muted">{c.hex.toUpperCase()}</span>}
          <button
            type="button"
            className="ui-reset ui-ring sp-onb-dot__remove"
            aria-label={`Remove ${c.name}`}
            onClick={() => editBrand({ colors: brand.colors.filter((_, j) => j !== i) })}
          >
            <X size={12} className="ui-icon" aria-hidden />
          </button>
        </span>
      ))}
      {brand.colors.length < MAX_COLORS && (
        <AddColorButton
          shape={shape === "dot" ? "dot" : "tile"}
          onClick={() =>
            editBrand({ colors: [...brand.colors, addedColor(brand.colors, "#808080")] })
          }
        />
      )}
    </div>
  );

  const fontSelects = (labelled: boolean) => (
    <div className="sp-onb-fonts">
      <FontPick
        role="Headings"
        label="Heading font"
        value={brand.headingFont}
        placeholder="Pick a heading font"
        options={FONT_OPTIONS(extraFonts)}
        onSelect={(f) => editBrand({ headingFont: f })}
        card={labelled}
      />
      <FontPick
        role="Body"
        label="Body font"
        value={brand.bodyFont}
        placeholder="Pick a body font"
        options={FONT_OPTIONS(extraFonts)}
        onSelect={(f) => editBrand({ bodyFont: f })}
        card={labelled}
      />
    </div>
  );

  let title: string;
  let body: React.ReactNode;
  let onSubmit: (() => void) | undefined;

  switch (step) {
    case "about":
      title = "Let’s get to know you";
      onSubmit = () => check("about") && go("setupFor");
      body = (
        <>
          <div className="sp-onb-questions">
            <Question
              label="What is your name?"
              htmlFor={ids.name}
              error={errors.name}
              errorId={`${ids.name}-e`}
            >
              <Input
                id={ids.name}
                value={answers.name}
                autoComplete="name"
                autoFocus
                aria-invalid={!!errors.name || undefined}
                aria-describedby={errors.name ? `${ids.name}-e` : undefined}
                onChange={(e) => set("name", e.target.value)}
              />
            </Question>
            <Question
              label="What is your role?"
              labelId={ids.role}
              error={errors.role}
              errorId={`${ids.role}-e`}
            >
              <OptionRadioGroup
                aria-labelledby={ids.role}
                aria-invalid={!!errors.role || undefined}
                aria-describedby={errors.role ? `${ids.role}-e` : undefined}
                layout="grid"
                options={ROLE_OPTIONS}
                value={answers.role}
                onChange={(v) => set("role", v)}
              />
            </Question>
          </div>
          <div className="sp-onb-actions">
            <div className="sp-onb-actions__row">{primary("Continue")}</div>
          </div>
        </>
      );
      break;

    case "setupFor":
      title = "Who are you setting SocialPaint up for?";
      onSubmit = () => check("setupFor") && go("team");
      body = (
        <>
          <div className="sp-onb-questions">
            <Question error={errors.setupFor} errorId={`${ids.role}-s`}>
              <OptionRadioGroup
                aria-labelledby={titleId}
                aria-invalid={!!errors.setupFor || undefined}
                aria-describedby={errors.setupFor ? `${ids.role}-s` : undefined}
                layout="full"
                options={SETUP_OPTIONS}
                value={answers.setupFor}
                onChange={(v) => set("setupFor", v)}
              />
            </Question>
            <Question label="How did you hear about SocialPaint?" labelId={ids.heard}>
              <Select
                ariaLabel="How did you hear about SocialPaint?"
                size="lg"
                placeholder="Choose one"
                value={answers.heardFrom}
                options={HEARD_OPTIONS}
                onSelect={(v) => set("heardFrom", v)}
              />
            </Question>
          </div>
          <div className="sp-onb-actions">
            <div className="sp-onb-actions__row">
              {back("about")}
              {primary("Continue")}
            </div>
          </div>
        </>
      );
      break;

    case "team":
      title = inApp ? "Tell us about the new company" : "Tell us about your team";
      onSubmit = () => check("team") && go("firstUp");
      body = (
        <>
          <div className="sp-onb-questions">
            <Question
              label="What is your company called?"
              htmlFor={ids.company}
              error={errors.companyName}
              errorId={`${ids.company}-e`}
            >
              <Input
                id={ids.company}
                value={answers.companyName}
                autoComplete="organization"
                autoFocus={inApp}
                aria-invalid={!!errors.companyName || undefined}
                aria-describedby={errors.companyName ? `${ids.company}-e` : undefined}
                onChange={(e) => set("companyName", e.target.value)}
              />
            </Question>
            <Question
              label="How many people work there?"
              labelId={ids.size}
              error={errors.teamSize}
              errorId={`${ids.size}-e`}
            >
              <OptionRadioGroup
                aria-labelledby={ids.size}
                aria-invalid={!!errors.teamSize || undefined}
                aria-describedby={errors.teamSize ? `${ids.size}-e` : undefined}
                layout="hug"
                options={SIZE_OPTIONS}
                value={answers.teamSize}
                onChange={(v: TeamSize) => set("teamSize", v)}
              />
            </Question>
            <Question label="Who will be making graphics?" labelId={ids.makers}>
              <OptionCheckboxGroup
                aria-labelledby={ids.makers}
                layout="hug"
                options={MAKER_OPTIONS}
                values={answers.makers}
                onChange={(v: Maker[]) => set("makers", v)}
              />
            </Question>
          </div>
          <div className="sp-onb-actions">
            <div className="sp-onb-actions__row">
              {inApp ? (
                <Button kind="neutral" size="lg" onClick={services.leave}>
                  Cancel
                </Button>
              ) : (
                back("setupFor")
              )}
              {primary("Continue")}
            </div>
          </div>
        </>
      );
      break;

    case "firstUp":
      title = "What do you want to make first?";
      onSubmit = () => go("website");
      body = (
        <>
          <div className="sp-onb-questions">
            <OptionCheckboxGroup
              aria-labelledby={titleId}
              layout="grid"
              options={FIRST_UP_OPTIONS}
              values={answers.firstUp}
              onChange={(v: FirstUp[]) => set("firstUp", v)}
            />
            <Question label="Where do you post the most?" labelId={ids.platforms}>
              <OptionCheckboxGroup
                aria-labelledby={ids.platforms}
                layout="hug"
                options={PLATFORM_OPTIONS}
                values={answers.platforms}
                onChange={(v: PostPlatform[]) => set("platforms", v)}
              />
            </Question>
          </div>
          <div className="sp-onb-actions">
            <div className="sp-onb-actions__row">
              {back("team")}
              {primary("Continue")}
            </div>
          </div>
        </>
      );
      break;

    case "website":
      title = "Where can we find your brand?";
      onSubmit = () => check("website") && void startPull();
      body = (
        <>
          <div className="sp-onb-questions">
            <Question
              label="What is your company website?"
              htmlFor={ids.website}
              error={errors.website}
              errorId={`${ids.website}-e`}
            >
              <Input
                id={ids.website}
                value={answers.website}
                autoComplete="url"
                inputMode="url"
                autoFocus
                aria-invalid={!!errors.website || undefined}
                aria-describedby={errors.website ? `${ids.website}-e` : undefined}
                onChange={(e) => set("website", e.target.value)}
              />
            </Question>
          </div>
          <div className="sp-onb-actions">
            <div className="sp-onb-actions__row">
              {back("firstUp")}
              {primary("Pull my brand")}
            </div>
            {textLink("I don’t have a website", () => {
              setBranch("manual");
              setPullNote(null);
              go("addBrand");
            })}
          </div>
        </>
      );
      break;

    case "addBrand":
      title = "Add your brand";
      onSubmit = () => go("brand");
      body = (
        <>
          {pullNote && <p className="t-body-s sp-onb-muted sp-onb-note">{pullNote}</p>}
          <div className="sp-onb-questions" data-dense>
            <Question label="What does your logo look like?" labelId={ids.logo}>
              <Upload
                placeholder="Upload your logo"
                thumbnail={brand.logoPreview}
                fileName={brand.logo?.name}
                aria-labelledby={ids.logo}
                onClick={() => fileRef.current?.click()}
                onDropFile={pickLogo}
              />
              {logoInput}
            </Question>
            <Question label="What are your brand colors?" labelId={ids.colors}>
              {colorEditor("dot")}
            </Question>
            <Question label="Which fonts do you use?" labelId={ids.fonts}>
              {fontSelects(false)}
            </Question>
          </div>
          <div className="sp-onb-actions">
            <div className="sp-onb-actions__row">
              {back("website")}
              {primary("Continue")}
            </div>
          </div>
        </>
      );
      break;

    case "pulling":
      title = `Pulling your brand from ${domain}`;
      body = (
        <ul className="sp-onb-pull" aria-live="polite">
          <PullRow label="Logo" status={pull.logo} />
          <PullRow label="Colors" status={pull.colors} />
          <PullRow label="Fonts" status={pull.fonts} />
        </ul>
      );
      break;

    case "brand":
      title = "Does this look like your brand?";
      onSubmit = () => void confirmBrand();
      body = (
        <>
          <div className="sp-onb-questions" data-dense>
            <Question label="Logos" labelId={ids.logo}>
              {brand.logoPreview ? (
                <div className="sp-onb-logos">
                  <button
                    type="button"
                    className="ui-reset ui-tint ui-ring sp-onb-logo-tile"
                    aria-label="Replace the logo"
                    onClick={() => fileRef.current?.click()}
                  >
                    <img src={brand.logoPreview} alt="" />
                  </button>
                </div>
              ) : (
                <Upload
                  placeholder="Upload your logo"
                  aria-labelledby={ids.logo}
                  onClick={() => fileRef.current?.click()}
                  onDropFile={pickLogo}
                />
              )}
              {logoInput}
            </Question>
            <Question label="Colors" labelId={ids.colors}>
              {colorEditor("card")}
            </Question>
            <Question label="Fonts" labelId={ids.fonts}>
              {fontSelects(true)}
            </Question>
          </div>
          {failure && (
            <p className="t-caption-s sp-onb-failure" role="alert">
              {failure}
            </p>
          )}
          <div className="sp-onb-actions">
            <div className="sp-onb-actions__row">
              {!created && back(branch === "manual" ? "addBrand" : "website")}
              {primary("Looks good")}
            </div>
          </div>
        </>
      );
      break;

    case "invite":
      title = `Who else should join ${companyName}?`;
      onSubmit = () => void sendInvites();
      body = (
        <>
          <div className="sp-onb-questions">
            <Question label="What are their emails?" labelId={ids.invites}>
              <div className="sp-onb-invites">
                {invites.map((row, i) => (
                  <div key={row.id} className="sp-onb-invite">
                    <div className="sp-onb-invite__row">
                      <Input
                        type="email"
                        value={row.email}
                        aria-label={`Email ${i + 1}`}
                        placeholder={domain ? `name@${domain.split("/")[0]}` : "name@company.com"}
                        aria-invalid={!!row.error || undefined}
                        aria-describedby={row.error ? `${ids.invites}-${row.id}` : undefined}
                        onChange={(e) =>
                          setInvites((rows) =>
                            rows.map((r) =>
                              r.id === row.id
                                ? { ...r, email: e.target.value, error: undefined }
                                : r,
                            ),
                          )
                        }
                      />
                      <Select
                        ariaLabel={`Role for email ${i + 1}`}
                        size="lg"
                        className="sp-onb-invite__role"
                        value={row.role}
                        options={ROLE_CHOICES}
                        onSelect={(role) =>
                          setInvites((rows) =>
                            rows.map((r) => (r.id === row.id ? { ...r, role } : r)),
                          )
                        }
                      />
                      {i > 0 && (
                        <IconButton
                          icon={X}
                          label={`Remove email ${i + 1}`}
                          onClick={() => setInvites((rows) => rows.filter((r) => r.id !== row.id))}
                        />
                      )}
                    </div>
                    {row.error && (
                      <p
                        id={`${ids.invites}-${row.id}`}
                        className="t-caption-s sp-onb-question__error"
                      >
                        {row.error}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {invites.length < MAX_INVITES && (
                <Button
                  kind="neutralOnPage"
                  size="sm"
                  icon={Plus}
                  className="sp-onb-add-invite"
                  onClick={() =>
                    setInvites((rows) => [
                      ...rows,
                      { id: nextInviteId.current++, email: "", role: "member" },
                    ])
                  }
                >
                  Add another
                </Button>
              )}
            </Question>
          </div>
          <div className="sp-onb-actions">
            <div className="sp-onb-actions__row">
              {back("brand")}
              {primary("Send invites")}
            </div>
            {textLink("Skip for now", () => go("ready"))}
          </div>
        </>
      );
      break;

    case "ready": {
      const name = firstName(answers.name);
      title = name && !inApp ? `Your workspace is ready, ${name}` : "Your workspace is ready";
      const count = starters.length;
      body = (
        <>
          <p className="t-body-l sp-onb-muted sp-onb-subtitle">
            {count === 0
              ? "Your starter templates are on their way. Use Restore starter templates if they don’t appear."
              : count === 1
                ? "One starter template is already in your brand."
                : `${NUMBER_WORDS[count] ?? count} starter templates are already in your brand.`}
          </p>
          {count > 0 && (
            <ul className="sp-onb-starters">
              {starters.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="ui-reset ui-ring sp-onb-starter"
                    onClick={() => void enter({ name: "template", templateId: t.id })}
                  >
                    <span className="sp-onb-starter__thumb">
                      <TemplateThumbnail template={t} brandKit={created?.kit ?? null} />
                    </span>
                    <span className="t-label-s">{t.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {failure && (
            <p className="t-caption-s sp-onb-failure" role="alert">
              {failure}
            </p>
          )}
          <div className="sp-onb-actions">
            <div className="sp-onb-actions__row">
              {primary("Go to my templates", () => void enter({ name: "portal" }))}
            </div>
          </div>
        </>
      );
      break;
    }
  }

  return (
    <PreAppShell layout="auth" width="wide" panel={<WorkspacePreview state={preview} />}>
      {progress && <ProgressSegments done={progress.done} total={progress.total} />}
      <h1 ref={titleRef} id={titleId} tabIndex={-1} className="t-title-page sp-onb-title">
        {title}
      </h1>
      <form
        ref={formRef}
        className="sp-onb-step"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onSubmit?.();
        }}
      >
        {body}
      </form>
    </PreAppShell>
  );
}

const NUMBER_WORDS: Record<number, string> = {
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
  6: "Six",
  7: "Seven",
  8: "Eight",
};

/** Moves focus to the first answer in error: an invalid input, or the
 * chosen (else first) tile of an invalid group. */
function focusFirstError(form: HTMLFormElement | null) {
  const first = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!first) return;
  if (first.matches("input, textarea, button")) return first.focus();
  const tile =
    first.querySelector<HTMLElement>('[aria-checked="true"]') ??
    first.querySelector<HTMLElement>("[role=radio], [role=checkbox]");
  tile?.focus();
}

function PullRow({ label, status }: { label: string; status: PullStatus }) {
  const tone = status === "found" ? "positive" : status === "looking" ? "active" : "neutral";
  const word =
    status === "found"
      ? "Found"
      : status === "looking"
        ? "Looking"
        : status === "notFound"
          ? "Not found"
          : "Waiting";
  return (
    <li className="sp-onb-pull__row" data-status={status}>
      <span className="t-label-m sp-onb-pull__label">{label}</span>
      <Status tone={tone}>{word}</Status>
    </li>
  );
}

/** A font choice: a plain Select on Add your brand, a card with the sample
 * on Your brand (259:761). */
function FontPick({
  role,
  label,
  value,
  placeholder,
  options,
  onSelect,
  card,
}: {
  role: string;
  label: string;
  value: string | undefined;
  placeholder: string;
  options: { value: string; label: string }[];
  onSelect(font: string): void;
  card: boolean;
}) {
  const select = (
    <Select
      ariaLabel={label}
      size="lg"
      placeholder={placeholder}
      value={value}
      options={options}
      onSelect={onSelect}
    />
  );
  if (!card) return select;
  return (
    <div className="sp-onb-font-card">
      {/* The brand's own face (content, PHASE-9 §9 D3) on the title step. */}
      <span className="t-title-page" style={{ fontFamily: value }} aria-hidden>
        Aa
      </span>
      <span className="sp-onb-font-card__text">
        {select}
        <span className="t-caption-s sp-onb-muted">{role}</span>
      </span>
    </div>
  );
}
