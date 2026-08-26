import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { FieldValues } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useBrand } from "@/lib/brand/BrandContext";
import { useRouter } from "../router";
import { ErrorState } from "./ErrorState";
import { TemplateFill } from "./TemplateFill";
import { Page } from "./layout/Page";

/** Member self-service flow. Loads the template through the authenticated
 * store, then hands it to the shared fill surface — the same component the
 * public link page uses, so the two paths cannot drift apart. */
export function TemplateUsePage({ templateId }: { templateId: string }) {
  const { kit } = useBrand();
  const { navigate } = useRouter();
  const templateState = useAsync(() => stores.templates.get(templateId), [templateId]);
  const template = templateState.status === "ready" ? templateState.data : null;
  const [values, setValues] = useState<FieldValues>({});

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

  return (
    <Page>
      <button
        onClick={() => navigate({ name: "portal" })}
        className="flex items-center gap-1.5 mb-5"
        style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}
      >
        <ArrowLeft style={{ width: 14, height: 14 }} />
        Brand Templates
      </button>

      <TemplateFill template={template} brandKit={kit} values={values} onValuesChange={setValues} />
    </Page>
  );
}
