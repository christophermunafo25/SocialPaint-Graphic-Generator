import React, { useEffect, useMemo, useRef, useState } from "react";
import type { BrandKit, FieldValues, TemplateSchema } from "@/lib/types";
import { isRequiredField } from "@/lib/templates/fieldRules";
import { requiredError } from "@/lib/templates/fieldCopy";
import { mergeCaption } from "@/lib/caption";
import { resolveFieldStyle } from "@/lib/brand/resolveStyle";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legalLinks";
import { applyVariantToSchema, getVariant, hasVariants } from "@/lib/templates/variants";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorState } from "./ErrorState";
import { SchemaRenderer, type SchemaRendererHandle } from "./SchemaRenderer";
import { ExportAssetError, type ExportOutcome } from "@/lib/render/exportPng";
import { celebrate } from "@/lib/celebrate";
import { openLinkedInComposer } from "@/lib/share/linkedin";
import { ArrowLeft, Check } from "lucide-react";
import { COPIED_MS, DetailField } from "./details/DetailsPanel";
import { LinkedInMark } from "./details/LinkedInMark";
import { TemplateThumbnail } from "./TemplateThumbnail";
import { Button, Field, LookTile, SegmentedControl, TextArea, Toast } from "./primitives";

interface TemplateFillProps {
  template: TemplateSchema;
  brandKit: BrandKit | null;
  values: FieldValues;
  onValuesChange(next: FieldValues): void;
  /** Record open/download usage through the authenticated store. False on
   * the public path, which has no session and counts its own events through
   * the link's own endpoint. */
  instrument?: boolean;
  /** Fired after an export that actually produced a graphic (a dismissed
   * share sheet is not one). `variantId` is the look it was exported in,
   * undefined on a single-variant template. */
  onExported?(outcome: Exclude<ExportOutcome, "canceled">, variantId?: string): void;
  /** Fired when the person sends the graphic to LinkedIn. Reported on the
   * CLICK, not on a confirmed post: LinkedIn tells us nothing about what
   * happens in their composer, so intent is the honest thing to measure.
   * Fires even when the popup is blocked: the intent was the same and the
   * caption went to their clipboard either way. */
  onShared?(): void;
  /** Whether member-fillable image fields are offered. A public link can turn
   * them off; the member path never does. */
  allowUploads?: boolean;
  /** Rendered under the steps. The public page puts its resume note here. */
  footer?: React.ReactNode;
  /** The public link page: the preview comes before the steps on a phone
   * (someone opening a link wants to see the graphic before they meet a
   * form). */
  variant?: "member" | "public";
}

type ToastKind = "downloaded" | "shared" | "error" | "linkedin" | "popup-blocked";

/** Today's export messages, on the Toast primitive. */
const TOAST_COPY: Record<ToastKind, string> = {
  downloaded: "Graphic downloaded. It's in your downloads folder, ready to post.",
  shared: "Graphic shared. Sent through your device's share sheet.",
  error: "Couldn't export the graphic. Try again. If it keeps failing, re-upload the photo.",
  linkedin:
    "LinkedIn is open in a new tab. Your caption is copied too, in case it didn't carry across. Attach the graphic from your downloads.",
  "popup-blocked":
    "Your browser blocked the new tab. Your caption is copied. Open LinkedIn and paste it into a new post.",
};

/** THE fill surface: the template filled in one step at a time on the
 * left, the live Preview on the right (CJ, 2026-10-04: the earlier step
 * form, on the new look's tokens and primitives, over the frames' single
 * Details panel). With several looks, "Choose a look" comes first; every
 * field is a step, reachable in one click from the step rail; Finish holds
 * the look switch, the caption and the downloads.
 *
 * Used unchanged by the signed-in member page and by the public link page,
 * so a fix in one is a fix in both, and the PNG a stranger exports from a
 * link is byte-identical to the one a member exports from the library.
 * Fillers change field CONTENT only; every guardrail the admin locked
 * travels with the schema and applies here regardless of who is filling. */
export function TemplateFill({
  template,
  brandKit,
  values,
  onValuesChange,
  instrument = true,
  onExported,
  onShared,
  allowUploads = true,
  footer,
  variant: place = "member",
}: TemplateFillProps) {
  /** Looks. The chosen look changes nothing about the VALUES: they are keyed
   * by fieldKey, which every look shares, so switching keeps every entry. */
  const multiLook = hasVariants(template);
  const [variantId, setVariantId] = useState<string | null>(null);
  const look = getVariant(template, variantId);
  /** The schema as the chosen look renders it: the form reads from this
   * too, so an element hidden in this look is not asked for. */
  const rendered = useMemo(() => applyVariantToSchema(template, variantId), [template, variantId]);
  /** What the canvas paints. On a link with uploads switched off, image
   * fields are not member fields for this visitor: they keep their designed
   * artwork whatever their optional flag. */
  const paintSchema = useMemo(
    () =>
      allowUploads
        ? template
        : {
            ...template,
            fields: template.fields.map((f) =>
              f.type === "image" && f.optional ? { ...f, optional: undefined } : f,
            ),
          },
    [template, allowUploads],
  );

  // Fixed elements render on the graphic like any field, but nobody fills
  // them in. Image fields drop out too when the link has uploads off.
  const formFields = useMemo(
    () =>
      (rendered.fields ?? []).filter(
        (f) => !f.static && f.type !== "shape" && (allowUploads || f.type !== "image"),
      ),
    [rendered, allowUploads],
  );
  const missingRequired = useMemo(
    () => formFields.filter((f) => isRequiredField(f) && !values[f.fieldKey]),
    [formFields, values],
  );

  /** Steps: the look picker (when there is a choice), one per field, then
   * Finish. Free to move in both directions. */
  const lead = multiLook ? 1 : 0;
  const finishStep = lead + formFields.length;
  const [step, setStep] = useState(0);
  // A step index can outlive the field list it pointed into (uploads turned
  // off, a look that hides a field): clamp rather than show a blank card.
  const current = Math.min(step, finishStep);
  const fieldIndex = current - lead;
  const onFinish = current === finishStep;
  const stepRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);
  useEffect(() => {
    // Land focus on the step's control so people can type at once, but not
    // on first render, where it would pull the page down.
    if (!movedRef.current) return;
    stepRef.current
      ?.querySelector<HTMLElement>(
        "input:not([type=file]), textarea, button.ui-upload, [role=radio][tabindex='0']",
      )
      ?.focus();
  }, [current]);
  const go = (next: number) => {
    movedRef.current = true;
    setStep(Math.max(0, Math.min(next, finishStep)));
  };

  /** The caption follows the fields until the person types in it. */
  const [caption, setCaption] = useState<string | null>(null);
  const shownCaption = caption ?? mergeCaption(template, values);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);

  /** Set by a refused Download: from then on an empty required field shows
   * its error on its step, and filling it clears it. */
  const [checked, setChecked] = useState(false);
  const errorOf = (key: string): string | undefined => {
    if (!checked) return undefined;
    const f = missingRequired.find((m) => m.fieldKey === key);
    return f ? requiredError(f) : undefined;
  };

  const [exporting, setExporting] = useState(false);
  /** A file exists: Download again, and Post to LinkedIn leads. */
  const [downloaded, setDownloaded] = useState(false);
  const [toast, setToast] = useState<{ kind: ToastKind; detail?: string } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const rendererRef = useRef<SchemaRendererHandle>(null);
  const downloadRef = useRef<HTMLButtonElement>(null);
  /** Text at its minimum size that still doesn't fit: said under the
   * preview; shortening the entry is the fix. */
  const [layoutWarnings, setLayoutWarnings] = useState<string[]>([]);

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
      window.clearTimeout(copiedTimer.current);
    },
    [],
  );

  const showToast = (kind: ToastKind, detail?: string) => {
    window.clearTimeout(toastTimer.current);
    setToast({ kind, detail });
    toastTimer.current = window.setTimeout(
      () => setToast(null),
      kind === "error" || kind === "popup-blocked" ? 6000 : 4000,
    );
  };

  const setValue = (fieldKey: string, value: string) =>
    onValuesChange({ ...values, [fieldKey]: value });

  /** A required field still empty: show the errors and take the person to
   * the first one. Returns whether it did. */
  const sendToMissing = (): boolean => {
    if (missingRequired.length === 0) return false;
    setChecked(true);
    go(lead + formFields.indexOf(missingRequired[0]));
    return true;
  };

  const handleDownload = async () => {
    if (sendToMissing() || !rendererRef.current) return;
    setExporting(true);
    try {
      const outcome = await rendererRef.current.exportPng();
      // Canceling the share sheet needs no confirmation of anything.
      if (outcome !== "canceled") {
        celebrate(downloadRef.current);
        setDownloaded(true);
        showToast(outcome);
        onExported?.(outcome, look?.id);
      }
    } catch (e) {
      console.error("Export failed", e);
      // Only an ExportAssetError message is filler-facing: it says WHICH
      // image is missing, which the generic line cannot.
      showToast(
        "error",
        e instanceof ExportAssetError ? `Couldn't export the graphic. ${e.message}` : undefined,
      );
    } finally {
      setExporting(false);
    }
  };

  /** Hand the caption to LinkedIn's composer. The graphic does NOT go with
   * it (LinkedIn takes no image from a URL), so the person attaches the
   * file they downloaded; the toast says so. A caption built from
   * half-filled fields is worse than none, so it waits for them too. */
  const handlePostToLinkedIn = () => {
    if (sendToMissing()) return;
    const opened = openLinkedInComposer(shownCaption);
    onShared?.();
    showToast(opened ? "linkedin" : "popup-blocked");
  };

  const copyCaption = async () => {
    await navigator.clipboard.writeText(shownCaption);
    setCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  };

  const pad = (n: number) => String(n).padStart(2, "0");
  const stepLabel = `Step ${pad(current + 1)} of ${pad(finishStep)}`;

  return (
    <>
      {toast && (
        <div className="sp-fill-toast" aria-live={toast.kind === "error" ? "assertive" : "polite"}>
          <Toast message={toast.detail ?? TOAST_COPY[toast.kind]} />
        </div>
      )}

      <div className="sp-fill" data-place={place}>
        {/* Left: the steps. */}
        <div className="sp-fill__form">
          {template.description && (
            <p className="t-body-s sp-fill__description">{template.description}</p>
          )}

          {/* The step rail: every step one click away, forward or back. A
              field's step shows a check once it has a value; Finish is the
              flag at the end. */}
          {(formFields.length > 0 || multiLook) && (
            <nav aria-label="Steps" className="sp-fill__rail">
              {multiLook && (
                <button
                  type="button"
                  className="ui-reset ui-ring-tight sp-fill__stepchip t-label-xs"
                  data-current={current === 0 || undefined}
                  aria-current={current === 0 ? "step" : undefined}
                  aria-label={`Step 1: Choose a look${look ? ` (${look.name})` : ""}`}
                  onClick={() => go(0)}
                >
                  Look
                </button>
              )}
              {formFields.map((f, i) => {
                const filled = Boolean(values[f.fieldKey]);
                const here = fieldIndex === i;
                return (
                  <button
                    key={f.id}
                    type="button"
                    className="ui-reset ui-ring-tight sp-fill__stepdot t-label-xs"
                    data-current={here || undefined}
                    data-filled={(filled && !here) || undefined}
                    data-error={(!filled && Boolean(errorOf(f.fieldKey))) || undefined}
                    aria-current={here ? "step" : undefined}
                    aria-label={`Step ${lead + i + 1}: ${f.label}${filled ? " (filled)" : ""}`}
                    title={f.label}
                    onClick={() => go(lead + i)}
                  >
                    {filled && !here ? <Check size={12} className="ui-icon" aria-hidden /> : i + 1}
                  </button>
                );
              })}
              <button
                type="button"
                className="ui-reset ui-ring-tight sp-fill__stepchip t-label-xs"
                data-current={onFinish || undefined}
                aria-current={onFinish ? "step" : undefined}
                aria-label="Finish: caption and download"
                onClick={() => go(finishStep)}
              >
                Finish
              </button>
            </nav>
          )}

          {/* Choose a look: live thumbnails through the one renderer.
              Picking one sets the look and moves to the first field. */}
          {multiLook && current === 0 && (
            <div ref={stepRef} className="sp-fill__step">
              <div className="sp-fill__stephead">
                <span className="sp-fill__eyebrow">{stepLabel}</span>
                <h2 className="t-label-l">Choose a look</h2>
              </div>
              <LookChoice
                template={template}
                selectedId={look?.id}
                onPick={(id) => {
                  setVariantId(id);
                  go(1);
                }}
              />
            </div>
          )}

          {/* One field at a time. Enter on a one-line field moves on. */}
          {fieldIndex >= 0 &&
            fieldIndex < formFields.length &&
            (() => {
              const field = formFields[fieldIndex];
              const maxLength = resolveFieldStyle(field, brandKit).maxLength;
              const length = (values[field.fieldKey] ?? "").length;
              return (
                <div
                  key={field.id}
                  ref={stepRef}
                  className="sp-fill__step"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
                      e.preventDefault();
                      go(current + 1);
                    }
                  }}
                >
                  <div className="sp-fill__stephead">
                    <span className="sp-fill__eyebrow">{stepLabel}</span>
                    {maxLength !== undefined && field.type !== "image" && (
                      <span
                        className="sp-fill__eyebrow"
                        role="status"
                        aria-live="polite"
                        aria-label={`${length} of ${maxLength} characters used`}
                      >
                        {length}/{maxLength}
                      </span>
                    )}
                  </div>
                  <DetailField
                    field={field}
                    value={values[field.fieldKey] ?? ""}
                    onChange={(v) => setValue(field.fieldKey, v)}
                    maxLength={maxLength}
                    error={errorOf(field.fieldKey)}
                    edited={false}
                  />
                  <div className="sp-fill__nav">
                    <Button
                      kind="neutral"
                      icon={ArrowLeft}
                      onClick={() => go(current - 1)}
                      disabled={current === 0}
                    >
                      Back
                    </Button>
                    <Button kind="primary" onClick={() => go(current + 1)}>
                      {fieldIndex === formFields.length - 1 ? "Finish" : "Next"}
                    </Button>
                  </div>
                </div>
              );
            })()}

          {/* Finish: the look switch, the caption, the downloads. */}
          {onFinish && (
            <>
              {multiLook && (
                <div className="sp-fill__step">
                  <Field label="Look">
                    <SegmentedControl
                      aria-label="Look"
                      options={(template.variants ?? []).map((v) => ({ id: v.id, label: v.name }))}
                      selectedId={look?.id ?? null}
                      onSelect={setVariantId}
                      className="sp-details__look"
                    />
                  </Field>
                </div>
              )}
              {template.captionTemplate && (
                <div className="sp-fill__step">
                  <Field
                    label="Caption"
                    action={{
                      label: copied ? "Copied" : "Copy",
                      onClick: () => void copyCaption(),
                    }}
                  >
                    <TextArea
                      value={shownCaption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="sp-fill__caption"
                    />
                  </Field>
                </div>
              )}
              <div className="sp-fill__step sp-fill__downloads">
                {downloaded ? (
                  <>
                    <Button
                      kind="primary"
                      size="lg"
                      icon={LinkedInMark}
                      onClick={handlePostToLinkedIn}
                    >
                      Post to LinkedIn
                    </Button>
                    <Button
                      ref={downloadRef}
                      kind="neutral"
                      size="lg"
                      onClick={() => void handleDownload()}
                      disabled={exporting}
                      aria-busy={exporting || undefined}
                    >
                      {exporting ? "Generating…" : "Download again"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      ref={downloadRef}
                      kind="primary"
                      size="lg"
                      onClick={() => void handleDownload()}
                      disabled={exporting}
                      aria-busy={exporting || undefined}
                    >
                      {exporting ? "Generating…" : "Download PNG"}
                    </Button>
                    <Button
                      kind="neutral"
                      size="lg"
                      icon={LinkedInMark}
                      onClick={handlePostToLinkedIn}
                    >
                      Post to LinkedIn
                    </Button>
                  </>
                )}
              </div>
              {finishStep > 0 && (
                <div>
                  <Button kind="neutralOnPage" icon={ArrowLeft} onClick={() => go(finishStep - 1)}>
                    {formFields.length > 0 ? "Back to fields" : "Back to looks"}
                  </Button>
                </div>
              )}
            </>
          )}

          {footer}
        </div>

        {/* Right: the live preview. */}
        <div className="sp-fill__preview">
          <div className="sp-fill__previewcard">
            <div className="sp-fill__previewhead">
              <h2 className="t-title-panel">Preview</h2>
              <span className="t-caption-s sp-fill__size">
                {template.canvasWidth} × {template.canvasHeight}
              </span>
            </div>
            <div
              className="sp-fill__art"
              style={
                {
                  "--art-ratio": template.canvasWidth / template.canvasHeight,
                } as React.CSSProperties
              }
            >
              {/* Canvas boundary: the form beside it keeps working even if
                  the preview can't render this template. */}
              <ErrorBoundary
                level="canvas"
                context={{ templateId: template.id }}
                resetKeys={[template, values]}
                fallback={(retry) => (
                  <ErrorState
                    title="We couldn't display this template."
                    detail="Your other templates are fine. Try again, and tell your admin about this one if it keeps happening."
                    onRetry={retry}
                  />
                )}
              >
                <SchemaRenderer
                  ref={rendererRef}
                  schema={paintSchema}
                  values={values}
                  brandKit={brandKit}
                  instrument={instrument}
                  onWarnings={setLayoutWarnings}
                  variantId={variantId}
                  emptyFields="hideOptional"
                />
              </ErrorBoundary>
            </div>
            {layoutWarnings.length > 0 && (
              <p role="status" className="t-caption-s sp-fill__note">
                {layoutWarnings[0]}
              </p>
            )}
          </div>
          <p className="t-caption-s sp-fill__legal">
            <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
              Terms of Service
            </a>
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </>
  );
}

/** The looks as live thumbnails on Look tiles: each the one renderer at
 * small scale with the placeholder values, so what the person picks is
 * what they will fill. A radio group; the arrows move the choice. */
function LookChoice({
  template,
  selectedId,
  onPick,
}: {
  template: TemplateSchema;
  selectedId: string | undefined;
  onPick(id: string): void;
}) {
  const looks = template.variants ?? [];
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = looks.findIndex((v) => v.id === selectedId);
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = looks[(Math.max(i, 0) + step + looks.length) % looks.length];
    refs.current.get(next.id)?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Looks" className="sp-fill__looks" onKeyDown={onKeyDown}>
      {looks.map((v) => {
        const on = v.id === selectedId;
        return (
          <LookTile
            key={v.id}
            ref={(el) => {
              if (el) refs.current.set(v.id, el);
              else refs.current.delete(v.id);
            }}
            role="radio"
            aria-checked={on}
            aria-label={v.name}
            tabIndex={on || (!selectedId && v === looks[0]) ? 0 : -1}
            selected={on}
            name={v.name}
            onClick={() => onPick(v.id)}
            thumbnail={
              <span
                className="sp-fill__lookthumb"
                style={{ aspectRatio: `${template.canvasWidth} / ${template.canvasHeight}` }}
              >
                <TemplateThumbnail template={template} variantId={v.id} />
              </span>
            }
          />
        );
      })}
    </div>
  );
}
