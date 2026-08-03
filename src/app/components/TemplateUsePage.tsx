import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Copy, Download, RefreshCw } from "lucide-react";
import type { FieldValues } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { mergeCaption } from "@/lib/caption";
import { useBrand } from "@/lib/brand/BrandContext";
import { useRouter } from "../router";
import { resolveFieldStyle } from "@/lib/brand/resolveStyle";
import { ErrorState } from "./ErrorState";
import { SchemaRenderer, type SchemaRendererHandle } from "./SchemaRenderer";
import { FieldInput } from "./FieldInput";
import { Page } from "./layout/Page";

/** Member self-service flow: fields on the left, live preview on the right,
 * suggested caption, PNG download. Members change field CONTENT only. */
export function TemplateUsePage({ templateId }: { templateId: string }) {
  const { kit } = useBrand();
  const { navigate } = useRouter();
  const templateState = useAsync(() => stores.templates.get(templateId), [templateId]);
  const template = templateState.status === "ready" ? templateState.data : null;
  const [values, setValues] = useState<FieldValues>({});
  const [caption, setCaption] = useState<string | null>(null); // null → follow suggestion
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  /** Post-export feedback toast; auto-dismisses. */
  const [exportToast, setExportToast] = useState<"downloaded" | "shared" | "error" | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const rendererRef = useRef<SchemaRendererHandle>(null);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const showToast = (kind: "downloaded" | "shared" | "error") => {
    window.clearTimeout(toastTimer.current);
    setExportToast(kind);
    toastTimer.current = window.setTimeout(() => setExportToast(null), kind === "error" ? 6000 : 4000);
  };

  const suggestedCaption = template ? mergeCaption(template, values) : "";
  const shownCaption = caption ?? suggestedCaption;

  // Static elements are baked into the graphic — members never fill them in.
  const formFields = useMemo(() => (template?.fields ?? []).filter((f) => !f.static), [template]);

  const missingRequired = useMemo(
    () => formFields.filter((f) => f.required && !values[f.fieldKey]),
    [formFields, values],
  );

  if (templateState.status === "loading") {
    return <p className="text-center py-24" style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>Loading template…</p>;
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
    return <p className="text-center py-24" style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>Template not found.</p>;
  }

  const handleDownload = async () => {
    if (!rendererRef.current) return;
    setExporting(true);
    try {
      const outcome = await rendererRef.current.exportPng();
      // Canceling the share sheet needs no confirmation of anything.
      if (outcome !== "canceled") showToast(outcome);
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
            <AlertTriangle style={{ width: 16, height: 16, color: "var(--state-danger)", flexShrink: 0, marginTop: 1 }} />
          ) : (
            <CheckCircle2 style={{ width: 16, height: 16, color: "var(--state-primary)", flexShrink: 0, marginTop: 1 }} />
          )}
          <span className="min-w-0">
            <span className="block" style={{ fontSize: "var(--type-label-size)", fontWeight: 500, color: "var(--text-primary)" }}>
              {exportToast === "downloaded" && "Graphic downloaded"}
              {exportToast === "shared" && "Graphic shared"}
              {exportToast === "error" && "Couldn't export the graphic"}
            </span>
            <span className="block" style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
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
        Brand templates
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left — field form */}
        <div className="lg:col-span-5 space-y-4">
          <div>
            <h1 className="sp-page-title">{template.name}</h1>
            {template.description && (
              <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)", marginTop: "var(--space-3xs)" }}>{template.description}</p>
            )}
          </div>

          {formFields.map((field, i) => {
            const maxLength = resolveFieldStyle(field, kit).maxLength;
            const inputId = `field-${field.id}`;
            return (
            <div key={field.id} className="sp-card p-4 space-y-2.5">
              <div>
                <p className="sp-eyebrow">Step {String(i + 1).padStart(2, "0")}</p>
                <label
                  htmlFor={inputId}
                  className="block"
                  style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginTop: 2 }}
                >
                  {field.label}
                  {field.required && (
                    <>
                      <span aria-hidden style={{ color: "var(--state-primary)" }}> *</span>
                      <span className="sr-only"> (required)</span>
                    </>
                  )}
                </label>
                {maxLength && (
                  <p
                    role="status"
                    aria-live="polite"
                    aria-label={`${(values[field.fieldKey] ?? "").length} of ${maxLength} characters used`}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}
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
            </div>
            );
          })}

          {/* Suggested caption */}
          {template.captionTemplate && (
            <div className="sp-card p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="sp-panel-title">Suggested caption</h2>
                {caption !== null && (
                  <button
                    onClick={() => setCaption(null)}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--state-primary)" }}
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
              <button onClick={handleCopy} className="sp-btn sp-btn-ghost w-full">
                {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
                {copied ? "Copied" : "Copy caption"}
              </button>
            </div>
          )}

          {/* Download */}
          <div className="sp-card p-4 space-y-2">
            <button
              onClick={handleDownload}
              disabled={exporting || missingRequired.length > 0}
              aria-describedby={missingRequired.length > 0 ? "download-blocked-reason" : undefined}
              className="sp-btn sp-btn-primary w-full"
              style={{ padding: "11px 14px" }}
            >
              {exporting ? <RefreshCw className="animate-spin" style={{ width: 14, height: 14 }} /> : <Download style={{ width: 14, height: 14 }} />}
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
            <div className="overflow-hidden" data-radius-card style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}>
              <SchemaRenderer
                ref={rendererRef}
                schema={template}
                values={values}
                brandKit={kit}
              />
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
