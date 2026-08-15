import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  RefreshCw,
} from "lucide-react";
import type { FieldValues } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { mergeCaption } from "@/lib/caption";
import { useBrand } from "@/lib/brand/BrandContext";
import { useRouter } from "../router";
import { resolveFieldStyle } from "@/lib/brand/resolveStyle";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorState } from "./ErrorState";
import { SchemaRenderer, type SchemaRendererHandle } from "./SchemaRenderer";
import { FieldInput } from "./FieldInput";
import { Page } from "./layout/Page";
import { celebrate } from "@/lib/celebrate";

/** Member self-service flow: fields on the left, live preview on the right,
 * suggested caption, PNG download. Members change field CONTENT only. */
export function TemplateUsePage({ templateId }: { templateId: string }) {
  const { kit } = useBrand();
  const { navigate } = useRouter();
  const templateState = useAsync(() => stores.templates.get(templateId), [templateId]);
  const template = templateState.status === "ready" ? templateState.data : null;
  const [values, setValues] = useState<FieldValues>({});
  /** One field per step; the last step (index formFields.length) is Finish —
   * caption + download. Steps are freely navigable in both directions. */
  const [step, setStep] = useState(0);
  const stepCardRef = useRef<HTMLDivElement>(null);
  const [caption, setCaption] = useState<string | null>(null); // null → follow suggestion
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  /** Post-export feedback toast; auto-dismisses. */
  const [exportToast, setExportToast] = useState<"downloaded" | "shared" | "error" | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const rendererRef = useRef<SchemaRendererHandle>(null);
  const downloadBtnRef = useRef<HTMLButtonElement>(null);
  /** Layout warnings (text at its minimum size that still doesn't fit) —
   * shown quietly under the preview; shortening the entry is the fix and
   * only the member can do it. */
  const [layoutWarnings, setLayoutWarnings] = useState<string[]>([]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => {
    // Land focus on the step's input so members can type immediately —
    // but not on first render, where it would yank the page down.
    if (step === 0) return;
    stepCardRef.current?.querySelector<HTMLElement>("input, textarea, select")?.focus();
  }, [step]);

  const showToast = (kind: "downloaded" | "shared" | "error") => {
    window.clearTimeout(toastTimer.current);
    setExportToast(kind);
    toastTimer.current = window.setTimeout(
      () => setExportToast(null),
      kind === "error" ? 6000 : 4000,
    );
  };

  const suggestedCaption = template ? mergeCaption(template, values) : "";
  const shownCaption = caption ?? suggestedCaption;

  // Fixed elements render on the graphic like any field, but members never
  // fill them in — no form entry, no required check.
  const formFields = useMemo(() => (template?.fields ?? []).filter((f) => !f.static), [template]);

  const missingRequired = useMemo(
    () => formFields.filter((f) => f.required && !values[f.fieldKey]),
    [formFields, values],
  );

  if (templateState.status === "loading") {
    return (
      <p
        className="text-center py-24"
        style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}
      >
        Loading template…
      </p>
    );
  }
  if (templateState.status === "error") {
    return (
      <ErrorState
        title="We couldn't load this template."
        detail="Check your connection and try again."
        onRetry={templateState.retry}
      />
    );
  }
  if (!template) {
    return (
      <p
        className="text-center py-24"
        style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}
      >
        Template not found.
      </p>
    );
  }

  const handleDownload = async () => {
    if (!rendererRef.current) return;
    setExporting(true);
    try {
      const outcome = await rendererRef.current.exportPng();
      // Canceling the share sheet needs no confirmation of anything.
      if (outcome !== "canceled") {
        showToast(outcome);
        // A finished graphic is the member's commit moment.
        celebrate(downloadBtnRef.current);
      }
    } catch (e) {
      console.error("Export failed", e);
      showToast("error");
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shownCaption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Page>
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
            </span>
            <span
              className="block"
              style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}
            >
              {exportToast === "downloaded" && "It's in your downloads folder, ready to post."}
              {exportToast === "shared" && "Sent through your device's share sheet."}
              {exportToast === "error" && "Try again — if it keeps failing, re-upload the photo."}
            </span>
          </span>
        </div>
      )}
      <button
        onClick={() => navigate({ name: "portal" })}
        className="flex items-center gap-1.5 mb-5"
        style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}
      >
        <ArrowLeft style={{ width: 14, height: 14 }} />
        Brand Templates
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left — field form */}
        <div className="lg:col-span-5 space-y-4">
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
                const current = step === i;
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
                aria-current={step === formFields.length ? "step" : undefined}
                style={{
                  height: 28,
                  padding: "0 12px",
                  borderRadius: "var(--radius-pill)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  border:
                    step === formFields.length
                      ? "1px solid transparent"
                      : "1px solid var(--border-strong)",
                  background: step === formFields.length ? "var(--fill-primary)" : "transparent",
                  color:
                    step === formFields.length ? "var(--text-on-accent)" : "var(--text-secondary)",
                  transition:
                    "background var(--dur-state) var(--ease), color var(--dur-state) var(--ease)",
                }}
              >
                Finish
              </button>
            </nav>
          )}

          {/* The current step — one field at a time. */}
          {step < formFields.length &&
            (() => {
              const field = formFields[step];
              const maxLength = resolveFieldStyle(field, kit).maxLength;
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
                      Step {String(step + 1).padStart(2, "0")} of{" "}
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
                    onChange={(v) => setValues((prev) => ({ ...prev, [field.fieldKey]: v }))}
                    inputId={inputId}
                  />
                  <div className="flex items-center justify-between" style={{ paddingTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setStep((n) => Math.max(0, n - 1))}
                      disabled={step === 0}
                      className="sp-btn sp-btn-ghost"
                      style={step === 0 ? { opacity: 0.4, cursor: "default" } : undefined}
                    >
                      <ArrowLeft style={{ width: 14, height: 14 }} />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep((n) => Math.min(n + 1, formFields.length))}
                      className="sp-btn sp-btn-primary"
                    >
                      {step === formFields.length - 1 ? "Finish" : "Next"}
                      <ArrowRight style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              );
            })()}

          {/* Finish step — caption + download. */}
          {step === formFields.length && (
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
        </div>

        {/* Right — live preview */}
        <div className="lg:col-span-7 lg:sticky lg:top-8">
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
              style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
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
                    detail="Your other templates are fine — try again, and tell your admin about this one if it keeps happening."
                    onRetry={retry}
                  />
                )}
              >
                <SchemaRenderer
                  ref={rendererRef}
                  schema={template}
                  values={values}
                  brandKit={kit}
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
    </Page>
  );
}
