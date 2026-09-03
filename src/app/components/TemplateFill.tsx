import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Linkedin,
  RefreshCw,
} from "lucide-react";
import type { BrandKit, FieldValues, TemplateSchema } from "@/lib/types";
import { mergeCaption } from "@/lib/caption";
import { resolveFieldStyle } from "@/lib/brand/resolveStyle";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorState } from "./ErrorState";
import { SchemaRenderer, type SchemaRendererHandle } from "./SchemaRenderer";
import { ExportAssetError, type ExportOutcome } from "@/lib/render/exportPng";
import { FieldInput } from "./FieldInput";
import { celebrate } from "@/lib/celebrate";
import { openLinkedInComposer } from "@/lib/share/linkedin";

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
   * share sheet is not one). */
  onExported?(outcome: Exclude<ExportOutcome, "canceled">): void;
  /** Fired when the person sends the graphic to LinkedIn. Reported on the
   * CLICK, not on a confirmed post — LinkedIn tells us nothing about what
   * happens in their composer, so intent is the honest thing to measure and
   * the dashboard says so. Fires even when the popup is blocked: the intent
   * was the same and the caption went to their clipboard either way. */
  onShared?(): void;
  /** Whether member-fillable image fields are offered. A public link can turn
   * them off; the member path never does. */
  allowUploads?: boolean;
  /** Rendered at the bottom of the form column. The public page puts its
   * resume note and its attribution here. */
  footer?: React.ReactNode;
  /** Put the live preview above the form on a phone. The public page turns
   * this on: someone opening a link from an email wants to see the graphic
   * before they meet a form. The member path keeps form-first, where the
   * person already chose the template from a gallery of previews. */
  previewFirstOnMobile?: boolean;
}

/** THE fill surface: one field per step on the left, live preview on the
 * right, suggested caption, PNG download.
 *
 * Used unchanged by the signed-in member page and by the public link page,
 * so a fix in one is a fix in both — and so the PNG a stranger exports from
 * a link is byte-identical to the one a member exports from the gallery.
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
  previewFirstOnMobile = false,
}: TemplateFillProps) {
  /** One field per step; the last step (index formFields.length) is Finish —
   * caption + download. Steps are freely navigable in both directions. */
  const [step, setStep] = useState(0);
  const stepCardRef = useRef<HTMLDivElement>(null);
  const [caption, setCaption] = useState<string | null>(null); // null → follow suggestion
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  /** Post-export feedback toast; auto-dismisses. */
  type ToastKind = "downloaded" | "shared" | "error" | "linkedin" | "popup-blocked";
  const [exportToast, setExportToast] = useState<ToastKind | null>(null);
  /** Whether this session has produced a file yet. LinkedIn cannot take the
   * image from us, so the guidance under the post button changes once the
   * person actually has something to attach. */
  const [exported, setExported] = useState(false);
  /** The refusal reason, when the export gate named one — it says WHICH
   * image is missing, which the generic line cannot. Only an
   * ExportAssetError message is filler-facing; anything else stays behind
   * the generic copy. */
  const [exportErrorDetail, setExportErrorDetail] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const rendererRef = useRef<SchemaRendererHandle>(null);
  const downloadBtnRef = useRef<HTMLButtonElement>(null);
  /** Layout warnings (text at its minimum size that still doesn't fit) —
   * shown quietly under the preview; shortening the entry is the fix and
   * only the person filling it in can do it. */
  const [layoutWarnings, setLayoutWarnings] = useState<string[]>([]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => {
    // Land focus on the step's input so people can type immediately — but
    // not on first render, where it would yank the page down.
    if (step === 0) return;
    stepCardRef.current?.querySelector<HTMLElement>("input, textarea, select")?.focus();
  }, [step]);

  const showToast = (kind: ToastKind) => {
    window.clearTimeout(toastTimer.current);
    setExportToast(kind);
    toastTimer.current = window.setTimeout(
      () => setExportToast(null),
      kind === "error" || kind === "popup-blocked" ? 6000 : 4000,
    );
  };

  const suggestedCaption = mergeCaption(template, values);
  const shownCaption = caption ?? suggestedCaption;

  // Fixed elements render on the graphic like any field, but nobody fills
  // them in — no form entry, no required check. Image fields drop out too
  // when the link has uploads switched off.
  const formFields = useMemo(
    () => (template.fields ?? []).filter((f) => !f.static && (allowUploads || f.type !== "image")),
    [template, allowUploads],
  );

  const missingRequired = useMemo(
    () => formFields.filter((f) => f.required && !values[f.fieldKey]),
    [formFields, values],
  );

  // A step index can outlive the field list it pointed into (uploads turned
  // off between renders); clamp rather than render a blank card.
  const currentStep = Math.min(step, formFields.length);

  const setValue = (fieldKey: string, value: string) =>
    onValuesChange({ ...values, [fieldKey]: value });

  const handleDownload = async () => {
    if (!rendererRef.current) return;
    setExporting(true);
    try {
      const outcome = await rendererRef.current.exportPng();
      // Canceling the share sheet needs no confirmation of anything.
      if (outcome !== "canceled") {
        setExported(true);
        showToast(outcome);
        onExported?.(outcome);
        // A finished graphic is the commit moment.
        celebrate(downloadBtnRef.current);
      }
    } catch (e) {
      console.error("Export failed", e);
      setExportErrorDetail(e instanceof ExportAssetError ? e.message : null);
      showToast("error");
    } finally {
      setExporting(false);
    }
  };

  /** Hand the caption to LinkedIn's composer.
   *
   * The graphic does NOT go with it — LinkedIn accepts no image from a URL,
   * so the person attaches the file themselves. That is a real limitation of
   * their platform, not something to paper over, so the copy under the
   * button says it plainly and the wording changes once they actually have
   * a file to attach. */
  const handlePostToLinkedIn = () => {
    const opened = openLinkedInComposer(shownCaption);
    onShared?.();
    showToast(opened ? "linkedin" : "popup-blocked");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shownCaption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <>
      {exportToast && (
        <div
          className="sp-toast"
          data-tone={exportToast === "error" ? "danger" : undefined}
          role={exportToast === "error" ? "alert" : "status"}
          aria-live={exportToast === "error" ? "assertive" : "polite"}
        >
          {exportToast === "error" ? (
            <AlertTriangle
              style={{
                width: 16,
                height: 16,
                color: "var(--state-danger)",
                flexShrink: 0,
                marginTop: 1,
              }}
            />
          ) : (
            <CheckCircle2
              style={{
                width: 16,
                height: 16,
                color: "var(--state-primary)",
                flexShrink: 0,
                marginTop: 1,
              }}
            />
          )}
          <span className="min-w-0">
            <span
              className="block"
              style={{
                fontSize: "var(--type-label-size)",
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              {exportToast === "downloaded" && "Graphic downloaded"}
              {exportToast === "shared" && "Graphic shared"}
              {exportToast === "error" && "Couldn't export the graphic"}
              {exportToast === "linkedin" && "LinkedIn is open in a new tab"}
              {exportToast === "popup-blocked" && "Your browser blocked the new tab"}
            </span>
            <span
              className="block"
              style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}
            >
              {exportToast === "downloaded" && "It's in your downloads folder, ready to post."}
              {exportToast === "shared" && "Sent through your device's share sheet."}
              {exportToast === "error" &&
                (exportErrorDetail ?? "Try again. If it keeps failing, re-upload the photo.")}
              {exportToast === "linkedin" &&
                "Your caption is copied too, in case it didn't carry across. Attach the graphic from your downloads."}
              {exportToast === "popup-blocked" &&
                "Your caption is copied. Open LinkedIn and paste it into a new post."}
            </span>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left — field form */}
        <div
          className={`lg:col-span-5 space-y-4 lg:order-1${previewFirstOnMobile ? " order-2" : ""}`}
        >
          <div>
            <h1 className="sp-page-title">{template.name}</h1>
            {template.description && (
              <p
                style={{
                  fontSize: "var(--type-label-size)",
                  color: "var(--text-muted)",
                  marginTop: "var(--space-3xs)",
                }}
              >
                {template.description}
              </p>
            )}
          </div>

          {/* Step rail — every step is reachable in one click, forward or
              back. A field's chip fills once it has a value; Finish is the
              flag at the end. */}
          {formFields.length > 0 && (
            <nav aria-label="Steps" className="flex flex-wrap items-center" style={{ gap: 6 }}>
              {formFields.map((f, i) => {
                const filled = Boolean(values[f.fieldKey]);
                const current = currentStep === i;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStep(i)}
                    aria-label={`Step ${i + 1}: ${f.label}${filled ? " (filled)" : ""}`}
                    aria-current={current ? "step" : undefined}
                    title={f.label}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "var(--radius-pill)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: current ? "1px solid transparent" : "1px solid var(--border-strong)",
                      background: current
                        ? "var(--fill-primary)"
                        : filled
                          ? "var(--bg-hover)"
                          : "transparent",
                      // --fill-primary is a BRAND fill (Voltage) — Ink is the
                      // only legible glyph on it in either theme. The inverted
                      // --text-on-action pairs with the neutral --fill-action
                      // only, and reads ~1.3:1 on Voltage in light mode.
                      color: current ? "var(--text-on-accent)" : "var(--text-secondary)",
                      transition:
                        "background var(--dur-state) var(--ease), color var(--dur-state) var(--ease)",
                    }}
                  >
                    {filled && !current ? <Check style={{ width: 12, height: 12 }} /> : i + 1}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setStep(formFields.length)}
                aria-label="Finish: caption and download"
                aria-current={currentStep === formFields.length ? "step" : undefined}
                style={{
                  height: 28,
                  padding: "0 12px",
                  borderRadius: "var(--radius-pill)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  border:
                    currentStep === formFields.length
                      ? "1px solid transparent"
                      : "1px solid var(--border-strong)",
                  background:
                    currentStep === formFields.length ? "var(--fill-primary)" : "transparent",
                  color:
                    currentStep === formFields.length
                      ? "var(--text-on-accent)"
                      : "var(--text-secondary)",
                  transition:
                    "background var(--dur-state) var(--ease), color var(--dur-state) var(--ease)",
                }}
              >
                Finish
              </button>
            </nav>
          )}

          {/* The current step — one field at a time. */}
          {currentStep < formFields.length &&
            (() => {
              const field = formFields[currentStep];
              const maxLength = resolveFieldStyle(field, brandKit).maxLength;
              const inputId = `field-${field.id}`;
              return (
                <div
                  key={field.id}
                  ref={stepCardRef}
                  className="sp-card p-4 space-y-2.5"
                  onKeyDown={(e) => {
                    // Enter advances on single-line inputs; textareas keep
                    // Enter for newlines, selects for choosing.
                    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
                      e.preventDefault();
                      setStep((n) => Math.min(n + 1, formFields.length));
                    }
                  }}
                >
                  <div>
                    <p className="sp-eyebrow">
                      Step {String(currentStep + 1).padStart(2, "0")} of{" "}
                      {String(formFields.length).padStart(2, "0")}
                    </p>
                    <label
                      htmlFor={inputId}
                      className="block"
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        marginTop: 2,
                      }}
                    >
                      {field.label}
                      {field.required && (
                        <>
                          <span aria-hidden style={{ color: "var(--state-primary)" }}>
                            {" "}
                            *
                          </span>
                          <span className="sr-only"> (required)</span>
                        </>
                      )}
                    </label>
                    {maxLength && (
                      <p
                        role="status"
                        aria-live="polite"
                        aria-label={`${(values[field.fieldKey] ?? "").length} of ${maxLength} characters used`}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        {(values[field.fieldKey] ?? "").length}/{maxLength}
                      </p>
                    )}
                  </div>
                  <FieldInput
                    field={{ ...field, maxLength }}
                    value={values[field.fieldKey] ?? ""}
                    onChange={(v) => setValue(field.fieldKey, v)}
                    inputId={inputId}
                  />
                  <div className="flex items-center justify-between" style={{ paddingTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setStep((n) => Math.max(0, n - 1))}
                      disabled={currentStep === 0}
                      className="sp-btn sp-btn-ghost"
                      style={currentStep === 0 ? { opacity: 0.4, cursor: "default" } : undefined}
                    >
                      <ArrowLeft style={{ width: 14, height: 14 }} />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep((n) => Math.min(n + 1, formFields.length))}
                      className="sp-btn sp-btn-primary"
                    >
                      {currentStep === formFields.length - 1 ? "Finish" : "Next"}
                      <ArrowRight style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              );
            })()}

          {/* Finish step — caption + download. */}
          {currentStep === formFields.length && (
            <>
              {template.captionTemplate && (
                <div className="sp-card p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="sp-panel-title">Suggested caption</h2>
                    {caption !== null && (
                      <button
                        onClick={() => setCaption(null)}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: "var(--state-primary)",
                        }}
                      >
                        Reset to suggestion
                      </button>
                    )}
                  </div>
                  <textarea
                    value={shownCaption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={4}
                    aria-label="Suggested caption"
                    className="sp-input"
                    style={{ resize: "vertical" }}
                  />
                  <button onClick={() => void handleCopy()} className="sp-btn sp-btn-ghost w-full">
                    {copied ? (
                      <Check style={{ width: 14, height: 14 }} />
                    ) : (
                      <Copy style={{ width: 14, height: 14 }} />
                    )}
                    {copied ? "Copied" : "Copy caption"}
                  </button>
                </div>
              )}

              <div className="sp-card p-4 space-y-2">
                <button
                  ref={downloadBtnRef}
                  onClick={() => void handleDownload()}
                  disabled={exporting || missingRequired.length > 0}
                  aria-describedby={
                    missingRequired.length > 0 ? "download-blocked-reason" : undefined
                  }
                  className="sp-btn sp-btn-primary w-full"
                  style={{ padding: "11px 14px" }}
                >
                  {exporting ? (
                    <RefreshCw className="animate-spin" style={{ width: 14, height: 14 }} />
                  ) : (
                    <Download style={{ width: 14, height: 14 }} />
                  )}
                  {exporting ? "Generating…" : "Download graphic"}
                </button>
                {missingRequired.length > 0 && (
                  <p
                    id="download-blocked-reason"
                    role="status"
                    aria-live="polite"
                    className="text-center"
                    style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}
                  >
                    Fill required: {missingRequired.map((f) => f.label).join(", ")}
                  </p>
                )}

                {/* Posting is the point of the whole graphic, so the path to
                    it sits with the download rather than a step away. Gated
                    on the same required fields, because a caption built from
                    half-filled merge tags is worse than no caption. */}
                <button
                  onClick={handlePostToLinkedIn}
                  disabled={missingRequired.length > 0}
                  className="sp-btn sp-btn-ghost w-full"
                  style={{ padding: "11px 14px" }}
                >
                  <Linkedin style={{ width: 14, height: 14 }} />
                  Post to LinkedIn
                </button>
                <p
                  className="text-center"
                  style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}
                >
                  {exported
                    ? "Opens a new post with your caption. Attach the graphic from your downloads, since LinkedIn can't take it from us."
                    : "Download the graphic first. LinkedIn can't take the image from us, so you'll attach it to the post yourself."}
                </p>
              </div>

              {formFields.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStep(formFields.length - 1)}
                  className="sp-btn sp-btn-ghost"
                >
                  <ArrowLeft style={{ width: 14, height: 14 }} />
                  Back to fields
                </button>
              )}
            </>
          )}

          {footer}
        </div>

        {/* Right — live preview. */}
        <div
          className={`lg:col-span-7 lg:sticky lg:top-8 lg:order-2${previewFirstOnMobile ? " order-1" : ""}`}
        >
          <div className="sp-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="sp-panel-title">Preview</h3>
              <span className="sp-eyebrow">
                {template.canvasWidth}×{template.canvasHeight} · live
              </span>
            </div>
            <div
              className="overflow-hidden"
              data-radius-card
              style={{
                background: "var(--bg-hover)",
                border: "1px solid var(--border)",
                // The renderer scales to this box's WIDTH, so the width is
                // capped from the viewport HEIGHT (minus the sticky offset
                // and the card's own chrome) via the canvas aspect ratio —
                // the whole graphic is visible without scrolling, portrait
                // formats included.
                maxWidth: `calc((100vh - 180px) * ${template.canvasWidth / template.canvasHeight})`,
                marginInline: "auto",
              }}
            >
              {/* Canvas boundary: the form beside it keeps working even if
                  the live preview can't render this template. */}
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
                  schema={template}
                  values={values}
                  brandKit={brandKit}
                  instrument={instrument}
                  onWarnings={setLayoutWarnings}
                />
              </ErrorBoundary>
              {layoutWarnings.length > 0 && (
                <p
                  role="status"
                  className="mt-2"
                  style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}
                >
                  {layoutWarnings[0]}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
