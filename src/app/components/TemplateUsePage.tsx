import React, { useState } from "react";
import { LayoutGrid, Link } from "lucide-react";
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
import { Button, PageHeader, Skeleton } from "./primitives";
import { AREA_ICON } from "./areas";

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
      <Page
        layout={{ className: "sp-fill-page" }}
        kind="self"
        footer={false}
        header={
          <div className="ui-page-header">
            <div className="ui-page-header__lead">
              <AREA_ICON.brandTemplates
                size={18}
                strokeWidth={1.5}
                className="ui-icon ui-page-header__icon"
                aria-hidden
              />
              <Skeleton width={220} height={14} />
            </div>
          </div>
        }
      >
        <div className="sp-fill" data-place="member" aria-busy="true" aria-label="Loading template">
          <div className="sp-fill__preview">
            <div className="sp-fill__stage" />
          </div>
          <div className="sp-details">
            <Skeleton width={80} height={13} />
            <div className="sp-details__fields">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} width="100%" height={36} radius="sm" />
              ))}
            </div>
            <Skeleton width="100%" height={44} radius="sm" />
          </div>
        </div>
      </Page>
    );
  }
  // With no form there are no links under a stage, so these two states
  // take the frame's footer links.
  if (templateState.status === "error") {
    return (
      <Page>
        <ErrorState
          title="We couldn't load this template."
          detail="Check your connection and try again."
          onRetry={templateState.retry}
        />
      </Page>
    );
  }
  if (!template) {
    return (
      <Page>
        <p className="tu-body-m text-center py-24" style={{ color: "var(--text-secondary)" }}>
          Template not found.
        </p>
      </Page>
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

  // The page is form only (new brand, PLAN.md decision 9): no way into the
  // template chat from here.
  const header = (
    <PageHeader
      icon={AREA_ICON.brandTemplates}
      crumbs={[
        { label: "Brand Templates", onClick: () => navigate({ name: "portal" }) },
        { label: template.name },
      ]}
      actions={
        (canBulkFill || canShare) && (
          <>
            {canBulkFill && (
              <Button
                kind="neutral"
                icon={LayoutGrid}
                onClick={() => navigate({ name: "bulk", templateId: template.id })}
              >
                Bulk fill
              </Button>
            )}
            {canShare && (
              <Button kind="neutral" icon={Link} onClick={() => setSharing(true)}>
                Public link
              </Button>
            )}
          </>
        )
      }
    />
  );

  return (
    // The page holds to the window in the app frame and the panel's fields
    // scroll ("self"); Terms and Privacy sit under the stage, so the frame
    // has no footer here.
    <Page layout={{ className: "sp-fill-page" }} kind="self" header={header} footer={false}>
      {sharing && <TemplateLinksDialog template={template} onClose={() => setSharing(false)} />}

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
