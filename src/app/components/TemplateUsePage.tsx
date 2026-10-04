import React, { useState } from "react";
import { LayoutGrid, Link, Sparkles } from "lucide-react";
import type { FieldValues } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { useRouter } from "../router";
import { ErrorState } from "./ErrorState";
import { Bone } from "./Skeleton";
import { TemplateFill } from "./TemplateFill";
import { TemplateLinksDialog } from "./admin/TemplateLinksDialog";
import { BreadcrumbHeader } from "./layout/Breadcrumb";
import { Page } from "./layout/Page";
import { Button } from "./primitives";

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
    // The fill page's shape (header, stage, panel), so nothing jumps when
    // the template lands.
    return (
      <Page layout={{ className: "sp-fill-page" }}>
        <div aria-busy="true" aria-label="Loading template">
          <div className="sp-shell-pagehead">
            <Bone w={220} h={14} tone="var(--surface-sunken)" />
          </div>
          <div className="sp-fill">
            <div className="sp-fill__form">
              <Bone w={220} h={28} r="var(--radius-pill)" tone="var(--surface-sunken)" />
              <div className="sp-fill__step">
                <Bone w={96} h={10} tone="var(--surface-sunken)" />
                <Bone w="100%" h={40} r="var(--radius-control-md)" tone="var(--surface-sunken)" />
              </div>
            </div>
            <div className="sp-fill__preview">
              <div className="sp-fill__previewcard">
                <Bone w={80} h={17} tone="var(--surface-sunken)" />
                <Bone w="100%" h={480} r="var(--radius-media-plate)" tone="var(--surface-sunken)" />
              </div>
            </div>
          </div>
        </div>
      </Page>
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
      <p className="t-body-s text-center py-24" style={{ color: "var(--text-secondary)" }}>
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
  /** Bulk fill follows the same rule: admin-only, and only once there is a
   * published template to fill. A draft has nothing to run forty times. */
  const canBulkFill = role === "admin" && template.status === "published";
  /** The template chat asks for each field and builds the graphic; it needs
   * a published template and somewhere for the chat to run
   * (isTemplateChatAvailable), and is for everyone. */
  const canAssist = template.status === "published" && stores.generate.isTemplateChatAvailable();

  return (
    <Page layout={{ className: "sp-fill-page" }}>
      {sharing && <TemplateLinksDialog template={template} onClose={() => setSharing(false)} />}

      <BreadcrumbHeader
        crumbs={[
          { label: "Brand Templates", onClick: () => navigate({ name: "portal" }) },
          { label: template.name },
        ]}
        actions={
          (canAssist || canBulkFill || canShare) && (
            <>
              {canAssist && (
                <Button
                  kind="neutralOnPage"
                  icon={Sparkles}
                  onClick={() => navigate({ name: "templateChat", templateId: template.id })}
                >
                  Use AI to assist
                </Button>
              )}
              {canBulkFill && (
                <Button
                  kind="neutralOnPage"
                  icon={LayoutGrid}
                  onClick={() => navigate({ name: "bulk", templateId: template.id })}
                >
                  Bulk fill
                </Button>
              )}
              {canShare && (
                <Button kind="neutralOnPage" icon={Link} onClick={() => setSharing(true)}>
                  Public link
                </Button>
              )}
            </>
          )
        }
      />

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
