import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import type { FieldValues } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { registerCustomFont } from "@/lib/render/fonts";
import {
  PublicLinkError,
  fetchPublicTemplate,
  recordPublicDownload,
  recordPublicShare,
  type PublicLinkFailure,
  type PublicTemplate,
} from "@/lib/publicLink/client";
import { clearDraft, hasDraftableFields, loadDraft, saveDraft } from "@/lib/publicLink/draft";
import { TemplateFill } from "../components/TemplateFill";
import { PublicFrame } from "./PublicFrame";
import { PublicLinkUnavailable } from "./PublicLinkUnavailable";

/** One public link, filled in by someone with no account.
 *
 * Everything below the load is the SAME component the signed-in member page
 * renders, given the same schema, the same brand values, and the same
 * values — which is what makes the exported PNG identical either way. */
export function PublicFillPage({ token }: { token: string }) {
  const state = useAsync(() => load(token), [token]);

  if (state.status === "loading") {
    return (
      <PublicFrame>
        <p
          className="text-center py-24"
          style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}
        >
          Opening your template…
        </p>
      </PublicFrame>
    );
  }

  if (state.status === "error") {
    const reason: PublicLinkFailure =
      state.error instanceof PublicLinkError ? state.error.reason : "unavailable";
    return (
      <PublicFrame>
        <PublicLinkUnavailable reason={reason} onRetry={state.retry} />
      </PublicFrame>
    );
  }

  return <PublicFill token={token} data={state.data} />;
}

/** Fetch the template, then register the uploaded typefaces it renders with
 * BEFORE anything measures text.
 *
 * The order matters: SchemaRenderer re-measures once on document.fonts.ready,
 * and a face registered after that moment would never trigger a second pass —
 * the preview and the export would both use fallback metrics. */
async function load(token: string): Promise<PublicTemplate> {
  const data = await fetchPublicTemplate(token);
  await Promise.all(data.fontAssets.map((asset) => registerCustomFont(asset)));
  return data;
}

function PublicFill({ token, data }: { token: string; data: PublicTemplate }) {
  const { template, brandKit, allowUploads } = data;

  const resumable = useMemo(() => hasDraftableFields(template.fields), [template.fields]);
  const [values, setValues] = useState<FieldValues>(
    () => (resumable ? loadDraft(token, template.fields) : null) ?? {},
  );
  /** Whether this session started from work the visitor left behind, so the
   * note can say "we brought this back" rather than "we might". */
  const [resumed] = useState(() => Object.keys(values).length > 0);

  useEffect(() => {
    if (!resumable) return;
    saveDraft(token, template.fields, values);
  }, [resumable, token, template.fields, values]);

  const onExported = useCallback(() => {
    // The admin who sent this link wants to know it worked. Counts an event,
    // identifies nobody.
    recordPublicDownload(token);
    // The graphic is made; a draft from here on would just be clutter the
    // next time this person opens the link.
    clearDraft(token);
  }, [token]);

  const onShared = useCallback(() => recordPublicShare(token), [token]);

  return (
    <PublicFrame>
      <TemplateFill
        template={template}
        brandKit={brandKit}
        values={values}
        onValuesChange={setValues}
        // No session, so no authenticated usage write. The link's own
        // endpoints count the open and the export instead.
        instrument={false}
        onExported={onExported}
        onShared={onShared}
        allowUploads={allowUploads}
        previewFirstOnMobile
        footer={<ResumeNote resumable={resumable} resumed={resumed} />}
      />
    </PublicFrame>
  );
}

/** Say what survives a closed tab, on the page, before it matters.
 *
 * A visitor who closes the tab and comes back should already know whether
 * their work is coming with them — finding out by losing it is the version
 * of this that costs the customer a speaker announcement. */
function ResumeNote({ resumable, resumed }: { resumable: boolean; resumed: boolean }) {
  if (!resumable) return null;
  return (
    <div
      className="flex items-start"
      style={{ gap: "var(--space-2xs)", paddingTop: "var(--space-3xs)" }}
    >
      <Info
        style={{ width: 14, height: 14, color: "var(--text-muted)", flexShrink: 0, marginTop: 2 }}
        aria-hidden
      />
      <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
        {resumed
          ? "We brought back what you'd typed. It's saved on this device only — a photo needs adding again, and another browser or phone will start fresh."
          : "What you type is saved on this device, so you can close the tab and come back. A photo isn't saved, and another browser or phone will start fresh."}
      </p>
    </div>
  );
}
