import React, { useMemo, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Globe,
  Image as ImageIcon,
  ImagePlus,
  X,
} from "lucide-react";
import type { FieldValues, GeneratedProposal, TemplateSchema } from "@/lib/types";
import { PLATFORMS, classifySize, platformById, type PlatformId } from "@/lib/templates/platforms";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { mergeCaption } from "@/lib/caption";
import { createCanvasMeasurer } from "@/lib/render/autoFit";
import { designToSchema } from "@/lib/generate/designToSchema";
import { measureProposal } from "@/lib/generate/measureProposal";
import { repairProposal } from "@/lib/generate/repairProposal";
import { stashSeed } from "@/lib/generate/seedHandoff";
import { useRouter } from "../../router";
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_ACCEPT,
  UploadChipView,
  imageAspectOf,
  readAndDownscale,
  rejectionMessage,
  useUploadChip,
} from "../imageUpload";
import { BrandMark } from "../BrandMark";
import { Page } from "../layout/Page";
import { TemplateFill } from "../TemplateFill";
import { TemplateThumbnail } from "../TemplateThumbnail";
import { Select, type SelectOption } from "../ui/Select";

/** One proposal, ready to show: the model's output, the template it fills,
 * and the values after the measurement pass (repaired where needed). */
interface ResultCard {
  proposal: GeneratedProposal;
  schema: TemplateSchema;
  values: FieldValues;
}

interface Results {
  cards: ResultCard[];
  warnings: string[];
  model: string;
  candidateCount: number;
  mode: "library" | "freestyle";
  /** The photo these drafts were made with, snapshotted at run time — a
   * later add or remove leaves shown drafts alone rather than silently
   * re-deriving them. */
  image: ComposerImage | null;
}

/** The member's photo, held in page state as a data URL. It NEVER leaves the
 * browser: it is not uploaded to Storage and not sent to the model — the
 * server sees only that a photo exists (hasImage) and its aspect. That is a
 * deliberate privacy property of this design, exactly how member photos work
 * on the fill page today. */
interface ComposerImage {
  dataUrl: string;
  aspect: number;
}

/** The image field a supplied photo lands in: the server-validated hint when
 * it names a member image slot, else the first member image field. Null when
 * the design has no member image slot at all. */
function imageTargetFor(proposal: GeneratedProposal, schema: TemplateSchema): string | null {
  const slots = schema.fields.filter((f) => f.type === "image" && !f.static);
  if (slots.length === 0) return null;
  const hinted = proposal.imageTargetFieldKey
    ? slots.find((f) => f.fieldKey === proposal.imageTargetFieldKey)
    : undefined;
  return (hinted ?? slots[0]).fieldKey;
}

/** A freestyle draft opened for editing — filled and exported entirely in
 * place, since there is no stored template to navigate to. Dies with the
 * page; nothing is persisted. */
interface EditingDraft {
  schema: TemplateSchema;
  values: FieldValues;
}

/** Example briefs behind the starter pills — full sentences in the product's
 * voice, so clicking one shows what a good brief looks like rather than
 * leaving a two-word stub to finish. */
const STARTERS: Array<{ label: string; brief: string }> = [
  {
    label: "Hiring",
    brief:
      "We're hiring a senior nurse practitioner for the Evanston clinic, posting on LinkedIn this week.",
  },
  {
    label: "Anniversary",
    brief: "Maria in billing hits ten years with us on Friday — we want to celebrate her.",
  },
  {
    label: "Event",
    brief: "Open house at the Lakeview location next Saturday from 10 to 2, everyone welcome.",
  },
  {
    label: "New hire",
    brief: "Welcoming James Cole, our new physical therapist, who starts Monday.",
  },
  {
    label: "Milestone",
    brief: "We just served our five thousandth patient this quarter.",
  },
  {
    label: "Spotlight",
    brief: "A spotlight on Dana at the front desk — patients keep naming her in reviews.",
  },
];

const platformIconStyle: React.CSSProperties = { width: 14, height: 14, flexShrink: 0 };

/** Generate: a member describes what they want to post and gets editable
 * pre-filled graphics back. Two modes, the member's choice:
 *
 *  - "My templates" (default): fills existing published templates — the
 *    model writes values only, and choosing a card lands on the ordinary
 *    fill page with the values seeded, where the usual open/download
 *    instrumentation applies.
 *  - "Something new": the model proposes a NEW layout, kept on brand by
 *    constraint — palette keys and brand type styles only, the published
 *    library as reference. The draft is ephemeral: filled and exported in
 *    place, never saved to the library.
 *
 * Composition (Figma 72:27 / 72:148): the brand mark over a centred
 * headline, one big prompt card that IS the interface — borderless
 * textarea, mode toggle, a compact platform picker, a round submit — with
 * starter chips beneath, the whole block vertically centred until a run
 * starts, and results below. Plain canvas background; the brand lives in
 * the graphics, not the chrome. */
export function GeneratePage({ templateIdHint }: { templateIdHint?: string }) {
  const { company, role } = useAuth();
  const { kit } = useBrand();
  const { navigate } = useRouter();

  const [brief, setBrief] = useState("");
  const [platform, setPlatform] = useState<PlatformId | null>(null);
  const [mode, setMode] = useState<"library" | "freestyle">("library");
  const [phase, setPhase] = useState<"idle" | "asking" | "measuring">("idle");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [editing, setEditing] = useState<EditingDraft | null>(null);
  // Saving a draft to the library: idle → busy → the created template's id.
  const [saveState, setSaveState] = useState<"idle" | "busy">("idle");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // The member's photo (see ComposerImage — it never leaves the browser).
  const [image, setImage] = useState<ComposerImage | null>(null);
  // The photo well hides until asked for: "Upload photo" opens it above the
  // brief. A paste lands the photo regardless — the well then shows it.
  const [wellOpen, setWellOpen] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  // A photo added or removed after drafts were made leaves them alone; one
  // line of copy says regenerating applies the change.
  const [photoChanged, setPhotoChanged] = useState(false);
  // The measuring pass, mid-flight: drafts land on screen as each one
  // resolves, skeletons holding the unresolved slots. Dies with the run.
  const [partial, setPartial] = useState<{
    total: number;
    processed: number;
    cards: ResultCard[];
  } | null>(null);
  const { chip, runChip, clearChip } = useUploadChip();

  const publishedState = useAsync(
    () => (company ? stores.templates.listPublished(company.id) : Promise.resolve([])),
    [company],
  );
  const published = publishedState.status === "ready" ? publishedState.data : null;
  // A stale hint (unpublished since the member left that card) degrades to a
  // library-wide generate rather than a server error.
  const hinted = templateIdHint ? published?.find((t) => t.id === templateIdHint) : undefined;
  // With no published templates the library mode has nothing to fill, but
  // freestyle still works from the brand kit — so the composer stays, forced
  // to freestyle, and says why.
  const libraryEmpty = published !== null && published.length === 0;

  const busy = phase !== "idle";

  // Platforms the published library actually covers, derived from each
  // template's canvas size — the same classification the catalogue's
  // shelves use. Uncovered platforms stay pickable but dim: the hint is a
  // preference, and the server already falls back to the whole library
  // with a warning when nothing matches.
  const libraryPlatforms = useMemo(() => {
    const covered = new Set<PlatformId>();
    for (const t of published ?? []) {
      for (const p of classifySize(t.canvasWidth, t.canvasHeight).platforms) covered.add(p);
    }
    return covered;
  }, [published]);
  // In freestyle the hint picks a canvas size, not a template, so nothing
  // dims there — every platform is equally reachable.
  const dimUncovered = mode === "library" && published !== null && !libraryEmpty;
  const anyDimmed = dimUncovered && PLATFORMS.some((p) => !libraryPlatforms.has(p.id));

  const platformOptions = useMemo<Array<SelectOption<string>>>(
    () => [
      { value: "", label: "Any platform", icon: <Globe style={platformIconStyle} aria-hidden /> },
      ...PLATFORMS.map((p) => ({
        value: p.id as string,
        label: p.label,
        icon: <p.Icon style={platformIconStyle} aria-hidden />,
        dimmed: dimUncovered && !libraryPlatforms.has(p.id),
      })),
    ],
    [dimUncovered, libraryPlatforms],
  );
  const PlatformTriggerIcon = platform ? platformById(platform).Icon : Globe;

  // The photo pipeline is FieldInput's, from the shared module: same accept,
  // same cap, same downscale, same rejection copy, same chip. No crop here —
  // candidate templates have different slot aspects, so a crop chosen now
  // would be wrong for most results; the fill page crops at the real
  // field's aspect.
  const acceptImage = (file: File) => {
    const processing = readAndDownscale(file)
      .then(async (scaled) => {
        const aspect = await imageAspectOf(scaled);
        setImageError(null);
        setImage({ dataUrl: scaled, aspect });
        if (results) setPhotoChanged(true);
      })
      .catch((e: unknown) => {
        console.error("Photo decode failed", e);
        setImageError(rejectionMessage(undefined));
        throw e instanceof Error ? e : new Error(String(e));
      });
    processing.catch(() => clearChip());
    runChip(file.name, processing);
  };

  const removeImage = () => {
    setImage(null);
    setImageError(null);
    setWellOpen(false);
    if (results) setPhotoChanged(true);
  };

  const imageDrop = useDropzone({
    onDrop: (accepted) => {
      if (accepted[0]) acceptImage(accepted[0]);
    },
    onDropRejected: (rejections: FileRejection[]) =>
      setImageError(rejectionMessage(rejections[0]?.errors[0]?.code)),
    accept: UPLOAD_ACCEPT,
    maxFiles: 1,
    maxSize: MAX_UPLOAD_BYTES,
    disabled: busy,
  });

  // Pasting an image anywhere in the composer lands it in the well, under
  // the same guardrails the dropzone enforces.
  const onComposerPaste = (e: React.ClipboardEvent) => {
    if (busy) return;
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (!file) return;
    e.preventDefault();
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setImageError(rejectionMessage("file-invalid-type"));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setImageError(rejectionMessage("file-too-large"));
      return;
    }
    acceptImage(file);
  };

  const run = async () => {
    if (!company || !brief.trim() || busy) return;
    setError(null);
    setResults(null);
    setPhotoChanged(false);
    setPhase("asking");
    try {
      const trimmedBrief = brief.trim();
      const effectiveMode = hinted ? "library" : libraryEmpty ? "freestyle" : mode;
      const res = await stores.generate.generate(company.id, {
        brief: trimmedBrief,
        platformHint: hinted ? undefined : (platform ?? undefined),
        templateIdHint: hinted?.id,
        count: 3,
        mode: effectiveMode,
        // Only the flag and the shape cross the wire — never the photo.
        ...(image
          ? { hasImage: true, imageAspect: Math.min(10, Math.max(0.1, image.aspect)) }
          : {}),
      });

      // The measurement pass: the function checked character counts; only a
      // browser can check glyphs. Overflowing values get one repair round;
      // a proposal that still overflows is dropped, never shown. Freestyle
      // designs have no stored template to repair against — the server
      // forces shrink sizing on all their text, so measure and drop honestly.
      setPhase("measuring");
      const measure = createCanvasMeasurer();
      const warnings = [...res.warnings];
      const cards: ResultCard[] = [];
      // Per-proposal resolution, verbatim from the old loop body — pulled
      // into a function only so each finished draft can land on screen
      // while the next one is still measuring or repairing.
      const resolveProposal = async (
        proposal: GeneratedProposal,
        i: number,
      ): Promise<ResultCard | null> => {
        if (proposal.design) {
          const schema = designToSchema(proposal.design, company.id, i + 1, {
            model: res.meta.model,
            generatedAt: res.meta.generatedAt,
          });
          const fit = measureProposal(schema, proposal.values, kit, measure);
          if (!fit.ok) {
            warnings.push(`Dropped the "${proposal.templateName}" design — its copy overflows.`);
            return null;
          }
          return { proposal, schema, values: proposal.values };
        }
        const schema = await stores.templates.get(proposal.templateId);
        if (!schema) {
          warnings.push(`"${proposal.templateName}" is no longer available — skipped.`);
          return null;
        }
        const outcome = await repairProposal(
          { templateId: proposal.templateId, values: proposal.values },
          schema,
          kit,
          measure,
          (templateId, fields) =>
            stores.generate
              .repair(company.id, { templateId, brief: trimmedBrief, fields })
              .then((r) => r.values),
        );
        if (!outcome.ok) {
          warnings.push(
            `Dropped a "${proposal.templateName}" draft — its copy couldn't be made to fit the design.`,
          );
          return null;
        }
        return { proposal, schema, values: outcome.values };
      };

      const total = res.proposals.length;
      setPartial({ total, processed: 0, cards: [] });
      for (const [i, proposal] of res.proposals.entries()) {
        const card = await resolveProposal(proposal, i);
        if (card) cards.push(card);
        // The grid swaps this slot's skeleton for the real draft; a dropped
        // proposal just retires its skeleton.
        setPartial({ total, processed: i + 1, cards: [...cards] });
      }

      if (cards.length === 0) {
        setError(
          "None of the drafts fit their templates. Try a shorter brief — or fill a template directly; the library is unaffected.",
        );
      } else {
        setResults({
          cards,
          warnings,
          model: res.meta.model,
          candidateCount: res.meta.candidateCount,
          mode: effectiveMode,
          image,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed — try again.");
    } finally {
      setPhase("idle");
      setPartial(null);
    }
  };

  const choose = (card: ResultCard) => {
    // The photo the drafts were made with rides along, seeded into its
    // target image field — uncropped, exactly as the card previewed it; the
    // fill page's crop control runs at the real field's aspect. A card
    // chosen mid-measure has no results snapshot yet; the live photo is the
    // run's photo, since the well is disabled while busy.
    const chosen = results ? results.image : image;
    const target = chosen ? imageTargetFor(card.proposal, card.schema) : null;
    const values = chosen && target ? { ...card.values, [target]: chosen.dataUrl } : card.values;
    // A library fill lands on the ordinary fill page. A freestyle design has
    // no stored template to navigate to, so it is filled and exported right
    // here — the fill surface takes a schema directly.
    if (card.proposal.design) {
      setEditing({ schema: card.schema, values });
      setSaveState("idle");
      setSavedId(null);
      setSaveError(null);
      return;
    }
    stashSeed(card.schema.id, values);
    navigate({ name: "template", templateId: card.schema.id });
  };

  // Prompt-box convention: Enter sends, Shift+Enter breaks the line.
  const onBriefKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void run();
    }
  };

  // Once a run starts, the question is answered: the hero collapses so the
  // page's weight moves to the drafts — and the shift happens on the
  // member's own submit, not when results land.
  const heroCollapsed = busy || results !== null;
  // Expanded (Figma 72:27): the brand mark over an h2-step headline, no
  // subline — the mark carries the space, and the freestyle helper under
  // the composer still explains "Something new". Vertical centring of the
  // whole block replaces the old top padding. Collapsed stays the bare
  // single line.
  const hero = (
    <div
      style={{
        textAlign: "center",
        paddingTop: heroCollapsed ? "var(--space-md)" : 0,
      }}
    >
      {!heroCollapsed && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "var(--space-sm)",
          }}
        >
          <BrandMark width={46} />
        </div>
      )}
      <h1
        style={{
          fontFamily: "var(--font-head)",
          fontWeight: "var(--weight-head)",
          fontSize: heroCollapsed ? "var(--type-cardtitle-size)" : "var(--type-h2-size)",
          lineHeight: heroCollapsed ? "var(--type-cardtitle-lh)" : "var(--type-h2-lh)",
          letterSpacing: "var(--track-head)",
          color: "var(--text-primary)",
        }}
      >
        What are we painting today?
      </h1>
    </div>
  );

  // The dev backend has no Edge Functions and no model key: an honest
  // disabled state, following the designImport precedent.
  if (!stores.generate.isConfigured()) {
    return (
      <Page narrow={760}>
        {hero}
        <div className="sp-emptystate" style={{ marginTop: "var(--space-lg)" }}>
          <p className="sp-emptystate__title">Generate isn't available on this backend</p>
          <p className="sp-emptystate__body">
            It needs the Supabase backend and an Anthropic API key (see .env.example). The template
            library and manual fill work as usual.
          </p>
        </div>
      </Page>
    );
  }

  // A freestyle draft being filled: the fill surface takes the ephemeral
  // schema directly, no store fetch, no usage instrumentation (there is no
  // template row to attribute it to — until an admin saves it). Leaving
  // without saving discards it, and the header says so.
  if (editing) {
    // Saving publishes through the ordinary templateStore — the design lands
    // in Brand Templates for everyone and in the Template Builder for the
    // marketing team to edit and republish, provenance stamped. The store
    // mints the real identity; the ephemeral one is stripped.
    const saveToLibrary = async () => {
      if (saveState === "busy" || savedId) return;
      setSaveState("busy");
      setSaveError(null);
      try {
        const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = editing.schema;
        const created = await stores.templates.create({ ...rest, status: "published" });
        setSavedId(created.id);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Saving failed — try again.");
      } finally {
        setSaveState("idle");
      }
    };

    return (
      <Page>
        <div className="flex items-center justify-between gap-3 mb-5">
          <button
            onClick={() => setEditing(null)}
            className="flex items-center gap-1.5"
            style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Back to drafts
          </button>
          <div className="flex items-center gap-3">
            {savedId ? (
              <>
                <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
                  Saved to Brand Templates.
                </p>
                <button
                  type="button"
                  className="sp-btn sp-btn-ghost"
                  onClick={() => navigate({ name: "builder", templateId: savedId })}
                >
                  Open in the builder
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
                  {saveError ??
                    (role === "admin"
                      ? "A new design from your brand kit — save it to the library, or export and leave it behind."
                      : "A new design from your brand kit — not saved to the library, so export before you leave.")}
                </p>
                {role === "admin" && (
                  <button
                    type="button"
                    className="sp-btn sp-btn-ghost"
                    disabled={saveState === "busy"}
                    onClick={() => void saveToLibrary()}
                  >
                    {saveState === "busy" ? "Saving…" : "Save to library"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <TemplateFill
          template={editing.schema}
          brandKit={kit}
          values={editing.values}
          onValuesChange={(next) => setEditing({ ...editing, values: next })}
          instrument={false}
        />
      </Page>
    );
  }

  return (
    <Page>
      {/* The 860px stage (the frames' composer width) closes before the
          drafts section so the results grid keeps the full column. Empty
          state: the block centres vertically; once a run starts the flag
          flips and the flow re-anchors to the top. */}
      <div className={heroCollapsed ? "sp-gen-stage" : "sp-gen-stage sp-gen-stage--centered"}>
        <div className="sp-gen-stage__inner">
          {hero}

          {/* The prompt card — the one control that matters, so it gets the
            stage: card padding at the content step, the photo well and the
            brief sharing one field, the controls as one footer strip, and a
            wash halo on focus. Elevation through surface colour, per the
            DS. */}
          <div
            className="sp-card sp-gen-composer"
            style={{
              marginTop: "var(--space-xl)",
              // Trimmed right/bottom so the 42px round submit optically
              // centres against the card edge (Figma 22/18/16/22).
              padding: "var(--space-md) var(--space-sm) var(--space-sm) var(--space-md)",
            }}
            onPaste={onComposerPaste}
          >
            {/* The photo well — hidden until "Upload photo" opens it (or a
              paste lands one), then it sits ABOVE the brief. The member's
              photo arrives BEFORE the choice, so every result card
              previews a finished graphic. Uncropped on purpose: slot
              aspects differ per template. */}
            {(wellOpen || image) && (
              <div style={{ marginBottom: "var(--space-xs)" }}>
                {image ? (
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <img
                      src={image.dataUrl}
                      alt="Your photo"
                      style={{
                        width: 72,
                        height: 72,
                        objectFit: "cover",
                        display: "block",
                        borderRadius: "var(--radius-control)",
                        border: "1px solid var(--border)",
                      }}
                    />
                    <button
                      type="button"
                      aria-label="Remove photo"
                      title="Remove photo"
                      disabled={busy}
                      onClick={removeImage}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 20,
                        height: 20,
                        borderRadius: "var(--radius-pill)",
                        background: "var(--fill-action)",
                        color: "var(--text-on-action)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <X style={{ width: 12, height: 12 }} aria-hidden />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center" style={{ gap: "var(--space-2xs)" }}>
                    <div
                      {...imageDrop.getRootProps({
                        role: "button",
                        "aria-label": "Add a photo (optional): JPG, PNG, or WEBP up to 10MB",
                      })}
                      data-active={imageDrop.isDragActive}
                      className="sp-dropzone flex flex-1 items-center justify-center cursor-pointer"
                      style={{
                        minHeight: 64,
                        gap: "var(--space-2xs)",
                        border: `1.5px dashed ${
                          imageDrop.isDragActive ? "var(--state-primary)" : "var(--border-strong)"
                        }`,
                        borderRadius: "var(--radius-control)",
                        background: imageDrop.isDragActive ? "var(--accent-wash)" : "transparent",
                      }}
                    >
                      <input {...imageDrop.getInputProps()} />
                      <ImagePlus
                        className="sp-dropzone__icon"
                        style={{ width: 16, height: 16, color: "var(--text-secondary)" }}
                        aria-hidden
                      />
                      <span
                        style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}
                      >
                        Click or drag to upload — JPG, PNG, or WEBP up to 10MB
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label="Hide photo upload"
                      title="Hide photo upload"
                      onClick={() => setWellOpen(false)}
                      style={{ color: "var(--text-muted)", display: "flex", flexShrink: 0 }}
                    >
                      <X style={{ width: 14, height: 14 }} aria-hidden />
                    </button>
                  </div>
                )}
              </div>
            )}
            <textarea
              rows={2}
              value={brief}
              maxLength={1500}
              onChange={(e) => setBrief(e.target.value)}
              onKeyDown={onBriefKeyDown}
              placeholder="We're hiring a senior nurse practitioner for the Evanston clinic, posting on LinkedIn this week."
              aria-label="Describe the post"
              disabled={busy}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                fontFamily: "var(--font-ui)",
                fontSize: "var(--type-composer-size)",
                lineHeight: "var(--type-composer-lh)",
                color: "var(--text-primary)",
              }}
            />
            {chip && <UploadChipView chip={chip} />}
            {imageError && (
              <p
                role="alert"
                style={{
                  marginTop: "var(--space-3xs)",
                  fontSize: "var(--type-caption-size)",
                  color: "var(--state-danger-on-surface)",
                }}
              >
                {imageError}
              </p>
            )}
            <div
              className="flex items-center justify-between gap-3"
              style={{
                marginTop: "var(--space-xs)",
                paddingTop: "var(--space-xs)",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center flex-wrap gap-2">
                {hinted ? (
                  <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
                    Using {hinted.name}.{" "}
                    <button
                      type="button"
                      onClick={() => navigate({ name: "generate" }, { replace: true })}
                      style={{ textDecoration: "underline", color: "var(--text-secondary)" }}
                    >
                      Search the whole library instead
                    </button>
                  </p>
                ) : (
                  <>
                    {libraryEmpty ? (
                      <p
                        style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}
                      >
                        No published templates yet — drafts come fresh from your brand kit.
                      </p>
                    ) : (
                      <div
                        className="flex items-stretch"
                        role="group"
                        aria-label="How to generate"
                        style={{
                          height: "var(--control-sm)",
                          padding: 3,
                          gap: 2,
                          borderRadius: "var(--radius-control-lg)",
                          background: "var(--bg-surface-raised)",
                        }}
                      >
                        {(
                          [
                            { id: "library", label: "My templates" },
                            { id: "freestyle", label: "Something new" },
                          ] as const
                        ).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            disabled={busy}
                            aria-pressed={mode === m.id}
                            onClick={() => setMode(m.id)}
                            style={{
                              padding: "0 var(--space-2xs)",
                              // Nested-radius math: the 12px track less its
                              // 3px inner padding.
                              borderRadius: 9,
                              fontSize: "var(--type-label-size)",
                              // One line, always — the .sp-seg rule. A wrapped
                              // label overflows the fixed control height; the
                              // row's flex-wrap handles narrow windows instead.
                              whiteSpace: "nowrap",
                              // The selected segment is the strip's brand
                              // moment: Voltage under Ink in both themes
                              // (the --fill-primary / --text-on-accent
                              // pairing rule).
                              background: mode === m.id ? "var(--fill-primary)" : "transparent",
                              color: mode === m.id ? "var(--text-on-accent)" : "var(--text-muted)",
                            }}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <Select
                      id="sp-gen-platform"
                      ariaLabel="Platform"
                      value={platform ?? ""}
                      options={platformOptions}
                      onSelect={(v) => setPlatform((v || null) as PlatformId | null)}
                      placeholder="Any platform"
                      disabled={busy}
                      triggerIcon={
                        <PlatformTriggerIcon
                          style={{ ...platformIconStyle, color: "var(--text-secondary)" }}
                          aria-hidden
                        />
                      }
                      triggerStyle={{
                        width: "auto",
                        height: "var(--control-sm)",
                        padding: "0 var(--space-2xs)",
                        fontSize: "var(--type-label-size)",
                        borderRadius: "var(--radius-control-lg)",
                      }}
                      menuMinWidth={220}
                      menuCaption={
                        anyDimmed
                          ? "Dimmed platforms have no published templates yet — picking one is a preference, and the whole library is still considered."
                          : undefined
                      }
                    />
                  </>
                )}
                {/* Opens the photo well above the brief; once the well is on
                  screen (or holds a photo) it is its own affordance. */}
                {!wellOpen && !image && (
                  <button
                    type="button"
                    className="sp-input flex items-center gap-1.5"
                    disabled={busy}
                    onClick={() => setWellOpen(true)}
                    style={{
                      width: "auto",
                      height: "var(--control-sm)",
                      padding: "0 var(--space-2xs)",
                      fontSize: "var(--type-label-size)",
                      borderRadius: "var(--radius-control-lg)",
                      cursor: "pointer",
                    }}
                  >
                    <ImagePlus
                      style={{ ...platformIconStyle, color: "var(--text-secondary)" }}
                      aria-hidden
                    />
                    Upload photo
                  </button>
                )}
              </div>
              <button
                type="button"
                className="sp-btn sp-gen-submit"
                disabled={!brief.trim() || busy}
                onClick={() => void run()}
                aria-label="Generate"
                title="Generate"
                style={{
                  width: 42,
                  height: 42,
                  padding: 0,
                  justifyContent: "center",
                  borderRadius: "var(--radius-pill)",
                  flexShrink: 0,
                }}
              >
                <ArrowUp style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>

          {mode === "freestyle" && !hinted && !libraryEmpty && !busy && (
            <p
              style={{
                marginTop: "var(--space-2xs)",
                textAlign: "center",
                fontSize: "var(--type-caption-size)",
                color: "var(--text-muted)",
              }}
            >
              New layouts stay inside your brand palette and type styles, guided by your published
              templates.
            </p>
          )}

          {/* Neutral starter pills. They stay reachable after drafts exist —
            in the quiet form, so a second idea doesn't need the field
            cleared by hand. */}
          {!busy && (
            <div
              className="flex flex-wrap justify-center"
              style={{ gap: "var(--space-xs)", marginTop: "var(--space-lg)" }}
            >
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className={results ? "sp-gen-pill sp-gen-pill--quiet" : "sp-gen-pill"}
                  onClick={() => setBrief(s.brief)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {error && (
            <p
              role="alert"
              style={{
                marginTop: "var(--space-sm)",
                textAlign: "center",
                fontSize: "var(--type-label-size)",
                color: "var(--state-danger-on-surface)",
              }}
            >
              {error}
            </p>
          )}
        </div>
      </div>

      {busy && (
        <div aria-busy="true" style={{ marginTop: "var(--space-lg)" }}>
          <h2
            style={{
              fontFamily: "var(--font-head)",
              fontWeight: "var(--weight-head)",
              fontSize: "var(--type-cardtitle-size)",
              lineHeight: "var(--type-cardtitle-lh)",
              letterSpacing: "var(--type-cardtitle-track)",
              color: "var(--text-primary)",
              marginBottom: "var(--space-2xs)",
            }}
          >
            Your drafts
          </h2>
          {/* The two phases as progress — same honest copy, now with the
              current step marked. No progress bar: the duration cannot be
              predicted, so a bar would be a guess. */}
          <div role="status" className="sp-gen-steps">
            <span className="sp-gen-step" data-state={phase === "asking" ? "current" : "done"}>
              <span className="sp-gen-step__dot" aria-hidden>
                {phase === "asking" ? "1" : <Check style={{ width: 11, height: 11 }} />}
              </span>
              Reading your brief and choosing templates from your library…
            </span>
            <span
              className="sp-gen-step"
              data-state={phase === "measuring" ? "current" : "pending"}
            >
              <span className="sp-gen-step__dot" aria-hidden>
                2
              </span>
              Checking every line of copy fits its design…
            </span>
          </div>
          {/* While measuring, drafts land as each one resolves — real cards
              fill the leading slots, skeletons hold the rest, and every
              slot keeps its hue across the swap. */}
          <div className="sp-grid-media">
            {(partial?.cards ?? []).map((card, i) => (
              <ProposalCard
                key={`${card.schema.id}-${i}`}
                card={card}
                index={i}
                hue={(i % 5) + 1}
                image={image?.dataUrl ?? null}
                onChoose={choose}
              />
            ))}
            {Array.from({
              length: partial ? Math.max(0, partial.total - partial.processed) : 3,
            }).map((_, j) => {
              const slot = (partial?.cards.length ?? 0) + j;
              return <SkeletonCard key={`slot-${slot}`} hue={(slot % 5) + 1} />;
            })}
          </div>
        </div>
      )}

      {results && !busy && (
        <div style={{ marginTop: "var(--space-lg)" }}>
          <h2
            style={{
              fontFamily: "var(--font-head)",
              fontWeight: "var(--weight-head)",
              fontSize: "var(--type-cardtitle-size)",
              lineHeight: "var(--type-cardtitle-lh)",
              letterSpacing: "var(--type-cardtitle-track)",
              color: "var(--text-primary)",
              marginBottom: "var(--space-sm)",
            }}
          >
            Your drafts
          </h2>
          {photoChanged && (
            <p
              style={{
                marginBottom: "var(--space-sm)",
                fontSize: "var(--type-caption-size)",
                color: "var(--text-muted)",
              }}
            >
              These drafts were made before your photo change — generate again to use it.
            </p>
          )}
          {results.warnings.length > 0 && (
            <div style={{ marginBottom: "var(--space-sm)" }}>
              {results.warnings.map((w) => (
                <p
                  key={w}
                  style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}
                >
                  {w}
                </p>
              ))}
            </div>
          )}
          <div className="sp-grid-media">
            {results.cards.map((card, i) => (
              <ProposalCard
                key={`${card.schema.id}-${i}`}
                card={card}
                index={i}
                hue={(i % 5) + 1}
                image={results.image?.dataUrl ?? null}
                onChoose={choose}
              />
            ))}
          </div>
          {/* Provenance, in the open: which model, from which library. */}
          <p
            style={{
              marginTop: "var(--space-sm)",
              fontSize: "var(--type-caption-size)",
              color: "var(--text-muted)",
            }}
          >
            {results.mode === "freestyle"
              ? `Drafted by ${results.model} from your brand kit${
                  results.candidateCount > 0
                    ? `, with ${results.candidateCount} published templates as reference`
                    : ""
                }.`
              : `Drafted by ${results.model} from ${
                  results.candidateCount === 1
                    ? "the template you picked"
                    : `${results.candidateCount} published templates`
                }.`}{" "}
            Everything stays editable before you export.
          </p>
        </div>
      )}
    </Page>
  );
}

/** A resolving slot: the real card's geometry and classes, so the swap to
 * the finished draft happens in place, its hue already on. */
function SkeletonCard({ hue }: { hue: number }) {
  return (
    <div
      className="sp-card sp-media-card sp-skeleton-card sp-gen-hue sp-gen-card sp-gen-skeleton"
      data-hue={hue}
      aria-hidden
    >
      <div className="sp-media-card__preview sp-skeleton__block" />
      <div className="sp-gen-card__namerow">
        <span className="sp-gen-card__index" />
        <span className="sp-skeleton__block sp-skeleton__line" style={{ width: "50%" }} />
      </div>
      <span className="sp-skeleton__block sp-skeleton__line" style={{ width: "90%" }} />
      <span className="sp-skeleton__block sp-skeleton__line" style={{ width: "70%" }} />
    </div>
  );
}

function ProposalCard({
  card,
  index,
  hue,
  image,
  onChoose,
}: {
  card: ResultCard;
  /** Position in the grid — the identity marker's numeral. */
  index: number;
  /** Identity slot (1–5) — explicit because the measuring grid mixes card
   * and skeleton element types, which nth-of-type counts separately. */
  hue: number;
  /** The photo these drafts were made with, or null. */
  image: string | null;
  onChoose(card: ResultCard): void;
}) {
  const { proposal, schema, values: baseValues } = card;
  // The supplied photo previews in its slot, and the "you'll add" line
  // subtracts that slot — a card whose only image slot is filled says
  // nothing about images, because there is nothing left to say.
  const target = image ? imageTargetFor(proposal, schema) : null;
  const values = image && target ? { ...baseValues, [target]: image } : baseValues;
  const imagesStillNeeded = proposal.imageFieldsNeeded.filter((f) => f.fieldKey !== target);
  const caption = proposal.caption || mergeCaption(schema, values);
  return (
    // The whole card is the choice — one control, one keyboard stop, the
    // template-card rule; the button at the bottom is the visible
    // affordance, decoration over this target.
    <button
      type="button"
      className="sp-card sp-media-card sp-template-card sp-gen-hue sp-gen-card"
      data-hue={hue}
      onClick={() => onChoose(card)}
      aria-label={`Edit and export "${schema.name}"${proposal.design ? " — a new design" : ""}`}
    >
      {/* The catalogue's square letterboxing frame: mixed proposal ratios
          sit even in the grid; contain, never crop. */}
      <span className="sp-media-card__preview">
        <span
          style={{
            display: "block",
            aspectRatio: `${schema.canvasWidth} / ${schema.canvasHeight}`,
            ...(schema.canvasWidth / schema.canvasHeight >= 1
              ? { width: "100%" }
              : { height: "100%" }),
          }}
        >
          <TemplateThumbnail template={schema} values={values} />
        </span>
      </span>
      <span className="sp-gen-card__namerow">
        <span className="sp-gen-card__index" aria-hidden>
          {index + 1}
        </span>
        <span
          className="truncate"
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: "var(--type-label-size)",
            color: "var(--text-primary)",
          }}
        >
          {schema.name}
        </span>
        {proposal.design && <span className="sp-gen-badge">New design</span>}
      </span>
      {proposal.why && (
        <span
          style={{
            display: "block",
            fontSize: "var(--type-caption-size)",
            lineHeight: "var(--type-caption-lh)",
            color: "var(--text-secondary)",
          }}
        >
          {proposal.why}
        </span>
      )}
      {caption && (
        <span style={{ display: "block" }}>
          <span
            className="sp-eyebrow"
            style={{ display: "block", marginBottom: "var(--space-3xs)" }}
          >
            Caption
          </span>
          <span
            style={{
              display: "block",
              fontSize: "var(--type-caption-size)",
              lineHeight: "var(--type-caption-lh)",
              color: "var(--text-secondary)",
            }}
          >
            {caption}
          </span>
        </span>
      )}
      {imagesStillNeeded.length > 0 && (
        <span
          className="flex items-center gap-1.5"
          style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}
        >
          <ImageIcon style={{ width: 13, height: 13, flexShrink: 0 }} aria-hidden />
          You'll add: {imagesStillNeeded.map((f) => f.label).join(", ")}
        </span>
      )}
      <span
        className="sp-btn sp-btn-primary"
        style={{ marginTop: "auto", alignSelf: "start" }}
        aria-hidden
      >
        Edit and export
        <ArrowRight style={{ width: 14, height: 14 }} />
      </span>
    </button>
  );
}
