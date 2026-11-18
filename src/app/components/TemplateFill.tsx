import React, { useEffect, useMemo, useRef, useState } from "react";
import type { BrandKit, FieldValues, TemplateSchema } from "@/lib/types";
import { isRequiredField } from "@/lib/templates/fieldRules";
import { requiredError } from "@/lib/templates/fieldCopy";
import { mergeCaption } from "@/lib/caption";
import { resolveFieldStyle } from "@/lib/brand/resolveStyle";
import { applyVariantToSchema, getVariant, hasVariants } from "@/lib/templates/variants";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorState } from "./ErrorState";
import { SchemaRenderer, type SchemaRendererHandle } from "./SchemaRenderer";
import { ExportAssetError, type ExportOutcome } from "@/lib/render/exportPng";
import { celebrate } from "@/lib/celebrate";
import { openLinkedInComposer } from "@/lib/share/linkedin";
import { Download } from "lucide-react";
import { DetailsPanel } from "./details/DetailsPanel";
import { Button, FooterLinks, Toast, focusFirstInvalid } from "./primitives";

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
  /** Rendered in the panel above its buttons. The public page puts its
   * resume note here. */
  footer?: React.ReactNode;
  /** Where the form sits: the fill page in the app frame, which holds it to
   * the window, or the public link page, which scrolls. */
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

/** THE fill surface (new brand, 2322:918; decision 9): the graphic on its
 * stage on the left, with Terms and Privacy under it, and the Details panel
 * on the right: Variation when the template has several, every member
 * field at once, then Caption, with Download PNG at the panel's foot. Once
 * a file exists, Download again and Post to LinkedIn take its place.
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
  /** Variations (looks in the schema). The chosen one changes nothing about
   * the VALUES: they are keyed by fieldKey, which every variation shares,
   * so switching keeps every entry. */
  const multiLook = hasVariants(template);
  const [variantId, setVariantId] = useState<string | null>(null);
  const look = getVariant(template, variantId);
  /** The schema as the chosen variation renders it: the form reads from
   * this too, so an element hidden in it is not asked for. */
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
        (f) =>
          !f.static &&
          f.type !== "shape" &&
          f.type !== "icon" &&
          (allowUploads || f.type !== "image"),
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

  /** Set by a refused Download: from then on an empty required field shows
   * its error, and filling it clears it. Each refusal takes the person to
   * the first one. */
  const [checked, setChecked] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (attempt > 0 && formRef.current) focusFirstInvalid(formRef.current);
  }, [attempt]);
  const errors = useMemo<Record<string, string | undefined>>(
    () =>
      checked ? Object.fromEntries(missingRequired.map((f) => [f.fieldKey, requiredError(f)])) : {},
    [checked, missingRequired],
  );

  const [exporting, setExporting] = useState(false);
  /** A file exists: Download again, and Post to LinkedIn leads. */
  const [downloaded, setDownloaded] = useState(false);
  // n tells a repeat of the same message from the last one, so the Toast
  // restarts its time (PROMPT.md section 7.2).
  const [toast, setToast] = useState<{ kind: ToastKind; detail?: string; n: number } | null>(null);
  const lastToast = useRef<{ kind: ToastKind; detail?: string } | null>(null);
  const rendererRef = useRef<SchemaRendererHandle>(null);
  const downloadRef = useRef<HTMLButtonElement>(null);
  /** Text at its minimum size that still doesn't fit: said under the
   * graphic; shortening the entry is the fix. */
  const [layoutWarnings, setLayoutWarnings] = useState<string[]>([]);

  // Download PNG gives way to Download again once a file exists: keep the
  // person's place by handing focus on to it.
  useEffect(() => {
    if (!downloaded) return;
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) downloadRef.current?.focus();
  }, [downloaded]);

  const showToast = (kind: ToastKind, detail?: string) => {
    setToast((prev) => ({ kind, detail, n: (prev?.n ?? 0) + 1 }));
  };
  // The kind of the toast showing or leaving, so its region and its time
  // hold while it eases out.
  if (toast) lastToast.current = toast;
  const toastKind = (toast ?? lastToast.current)?.kind;

  const setValue = (fieldKey: string, value: string) =>
    onValuesChange({ ...values, [fieldKey]: value });

  /** A required field still empty: show the errors and take the person to
   * the first one. Returns whether it did. */
  const sendToMissing = (): boolean => {
    if (missingRequired.length === 0) return false;
    setChecked(true);
    setAttempt((n) => n + 1);
    return true;
  };

  const handleDownload = async () => {
    if (exporting || sendToMissing() || !rendererRef.current) return;
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
   * file they downloaded; the toast says so. */
  const handlePostToLinkedIn = () => {
    if (sendToMissing()) return;
    const opened = openLinkedInComposer(shownCaption);
    onShared?.();
    showToast(opened ? "linkedin" : "popup-blocked");
  };

  // Download PNG looks disabled until every required field has a value, as
  // drawn, but stays a stop in the tab order: pressed early, it says what
  // is missing and takes the person there. While a file is being made the
  // button keeps its place in the tab order too, and a press does nothing.
  const incomplete = missingRequired.length > 0;
  const actions = downloaded ? (
    <>
      <Button
        ref={downloadRef}
        kind="neutral"
        size="lg"
        onClick={() => void handleDownload()}
        aria-disabled={exporting || undefined}
        aria-busy={exporting || undefined}
      >
        {exporting ? "Generating…" : "Download again"}
      </Button>
      <Button kind="primary" size="lg" className="sp-details__grow" onClick={handlePostToLinkedIn}>
        Post to LinkedIn
      </Button>
    </>
  ) : (
    <Button
      ref={downloadRef}
      kind="primary"
      size="lg"
      icon={Download}
      className="sp-details__grow"
      onClick={() => void handleDownload()}
      aria-disabled={incomplete || exporting || undefined}
      aria-busy={exporting || undefined}
    >
      {exporting ? "Generating…" : "Download PNG"}
    </Button>
  );

  return (
    <>
      <div className="sp-fill-toast" aria-live={toastKind === "error" ? "assertive" : "polite"}>
        <Toast
          open={toast !== null}
          message={toast ? (toast.detail ?? TOAST_COPY[toast.kind]) : undefined}
          messageKey={toast?.n}
          duration={toastKind === "error" || toastKind === "popup-blocked" ? 6000 : 4000}
          onTimeout={() => setToast(null)}
        />
      </div>

      <div className="sp-fill" data-place={place}>
        {/* The stage (2322:931), with Terms and Privacy under it, here and
            on the public link page, which renders this form outside the
            app frame. */}
        <div className="sp-fill__preview">
          <div className="sp-fill__stage">
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
          </div>
          {layoutWarnings.length > 0 && (
            <p role="status" className="t-caption-m sp-fill__note">
              {layoutWarnings[0]}
            </p>
          )}
          <FooterLinks className="sp-fill__legal" />
        </div>

        <DetailsPanel
          title="Details"
          className="sp-fill__details"
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
          maxLengthFor={(field) => resolveFieldStyle(field, brandKit).maxLength}
          errors={errors}
          caption={template.captionTemplate ? { value: shownCaption, onChange: setCaption } : null}
          formRef={formRef}
          footerLead={footer}
          footer={actions}
        />
      </div>
    </>
  );
}
