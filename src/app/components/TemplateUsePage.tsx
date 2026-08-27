import React, { useState } from "react";
import { ArrowLeft, Link2 } from "lucide-react";
import type { FieldValues } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { useRouter } from "../router";
import { ErrorState } from "./ErrorState";
import { TemplateFill } from "./TemplateFill";
import { TemplateLinksDialog } from "./admin/TemplateLinksDialog";
import { Page } from "./layout/Page";

/** Member self-service flow. Loads the template through the authenticated
 * store, then hands it to the shared fill surface — the same component the
 * public link page uses, so the two paths cannot drift apart. */
export function TemplateUsePage({ templateId }: { templateId: string }) {
  const { kit } = useBrand();
  const { role } = useAuth();
  const { navigate } = useRouter();
  const templateState = useAsync(() => stores.templates.get(templateId), [templateId]);
  const template = templateState.status === "ready" ? templateState.data : null;
  const [values, setValues] = useState<FieldValues>({});
  const [sharing, setSharing] = useState(false);

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

  /** Sharing a template publicly is an admin decision, and this page is the
   * moment an admin is actually looking at the thing they want to share.
   * Members see the fill flow and nothing else — the button does not exist
   * for them, not merely disabled. Draft templates have nothing to share
   * yet, and the dialog says so rather than the button vanishing without
   * explanation. */
  const canShare = role === "admin";

  return (
    <Page>
      {sharing && <TemplateLinksDialog template={template} onClose={() => setSharing(false)} />}

      <div className="flex items-center justify-between gap-3 mb-5">
        <button
          onClick={() => navigate({ name: "portal" })}
          className="flex items-center gap-1.5"
          style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} />
          Brand Templates
        </button>

        {canShare && (
          <button
            onClick={() => setSharing(true)}
            className="sp-btn sp-btn-ghost"
            title="Create a link anyone can fill in without an account"
          >
            <Link2 style={{ width: 14, height: 14 }} />
            Public link
          </button>
        )}
      </div>

      <TemplateFill
        template={template}
        brandKit={kit}
        values={values}
        onValuesChange={setValues}
        // Opens and downloads are recorded inside SchemaRenderer; a share
        // happens outside the canvas, so this is its one recording point.
        onShared={() => void stores.usage.record(template.companyId, template.id, "share")}
      />
    </Page>
  );
}
