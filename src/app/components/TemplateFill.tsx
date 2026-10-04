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
import { DetailsPanel } from "./details/DetailsPanel";
import { LinkedInMark } from "./details/LinkedInMark";
import { Button, Toast, focusFirstInvalid } from "./primitives";

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
  /** Rendered under the graphic. The public page puts its resume note here. */
  footer?: React.ReactNode;
  /** The public link page: the split sizes to its own frame, and the graphic
   * comes before the panel on a phone (someone opening a link wants to see
   * the graphic before they meet a form). */
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

/** THE fill surface (new look, 156:674 and 159:716): the graphic on a
 * sunken stage beside the Details panel. Look, every member field and the
 * caption sit in the panel; Download PNG at its foot, then Download again
 * and Post to LinkedIn once there is a file.
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

  /** The caption follows the fields until the person types in it. */
  const [caption, setCaption] = useState<string | null>(null);
  const shownCaption = caption ?? mergeCaption(template, values);

  /** Set by a Download with required fields empty: from then on each empty
   * required field shows its error, and fills clear them one by one. */
  const [checked, setChecked] = useState(false);
  const errors = useMemo(() => {
    if (!checked) return {};
    return Object.fromEntries(missingRequired.map((f) => [f.fieldKey, requiredError(f)]));
  }, [checked, missingRequired]);

  const [exporting, setExporting] = useState(false);
  /** A file exists: the footer offers Download again and Post to LinkedIn. */
  const [downloaded, setDownloaded] = useState(false);
  const [toast, setToast] = useState<{ kind: ToastKind; detail?: string } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const rendererRef = useRef<SchemaRendererHandle>(null);
  const downloadRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  /** Text at its minimum size that still doesn't fit: said under the
   * graphic; shortening the entry is the fix. */
  const [layoutWarnings, setLayoutWarnings] = useState<string[]>([]);
  const [focusInvalid, setFocusInvalid] = useState(0);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  // After a refused Download has drawn its errors, focus the first one.
  useEffect(() => {
    if (focusInvalid && formRef.current) focusFirstInvalid(formRef.current);
  }, [focusInvalid]);

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

  const handleDownload = async () => {
    if (missingRequired.length > 0) {
      setChecked(true);
      setFocusInvalid((n) => n + 1);
      return;
    }
    if (!rendererRef.current) return;
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
   * file they just downloaded; the toast says so. */
  const handlePostToLinkedIn = () => {
    const opened = openLinkedInComposer(shownCaption);
    onShared?.();
    showToast(opened ? "linkedin" : "popup-blocked");
  };

  const footerButtons = downloaded ? (
    <>
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
      <Button
        kind="primary"
        size="lg"
        icon={LinkedInMark}
        onClick={handlePostToLinkedIn}
        className="sp-fill__grow"
      >
        Post to LinkedIn
      </Button>
    </>
  ) : (
    <Button
      ref={downloadRef}
      kind="primary"
      size="lg"
      onClick={() => void handleDownload()}
      disabled={exporting}
      aria-busy={exporting || undefined}
      className="sp-fill__grow"
    >
      {exporting ? "Generating…" : "Download PNG"}
    </Button>
  );

  return (
    <>
      {toast && (
        <div className="sp-fill-toast" aria-live={toast.kind === "error" ? "assertive" : "polite"}>
          <Toast message={toast.detail ?? TOAST_COPY[toast.kind]} />
        </div>
      )}

      <div className="sp-fill" data-place={place}>
        <div className="sp-fill__graphic">
          <div className="sp-fill__stage">
            <div
              className="sp-fill__art"
              style={
                {
                  "--art-ratio": template.canvasWidth / template.canvasHeight,
                } as React.CSSProperties
              }
            >
              {/* Canvas boundary: the panel beside it keeps working even if
                  the graphic can't render this template. */}
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
          </div>
          {layoutWarnings.length > 0 && (
            <p role="status" className="t-caption-s sp-fill__note">
              {layoutWarnings[0]}
            </p>
          )}
          {footer}
          <p className="t-caption-s sp-fill__legal">
            <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
              Terms of Service
            </a>
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>
          </p>
        </div>

        <DetailsPanel
          title="Details"
          className="sp-fill__panel"
          formRef={formRef}
          look={
            multiLook
              ? {
                  options: (template.variants ?? []).map((v) => ({ id: v.id, label: v.name })),
                  selectedId: look?.id ?? null,
                  onSelect: setVariantId,
                }
              : null
          }
          fields={formFields}
          values={values}
          onValueChange={setValue}
          maxLengthFor={(f) => resolveFieldStyle(f, brandKit).maxLength}
          errors={errors}
          caption={template.captionTemplate ? { value: shownCaption, onChange: setCaption } : null}
          footer={footerButtons}
        />
      </div>
    </>
  );
}
