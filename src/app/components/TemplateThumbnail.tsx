import React, { useMemo } from "react";
import type { FieldValues, TemplateSchema } from "@/lib/types";
import { useBrand } from "@/lib/brand/BrandContext";
import { ErrorBoundary } from "./ErrorBoundary";
import { SchemaRenderer } from "./SchemaRenderer";
import photoPlaceholder from "@/assets/socialpaint/photo-placeholder.jpg";

/** Card-sized live preview of a template (no usage instrumentation). One
 * template that can't render shows a quiet placeholder card; it must never
 * take the whole gallery grid down with it.
 *
 * Member photo slots get a standard placeholder portrait — a gallery card
 * should look like a finished graphic, not a form. Thumbnails ONLY: the
 * member flow keeps the empty upload state, where "no photo yet" is the
 * honest signal. */
export function TemplateThumbnail({ template }: { template: TemplateSchema }) {
  const { kit } = useBrand();
  const values = useMemo<FieldValues>(() => {
    const out: FieldValues = {};
    for (const f of template.fields) {
      if (f.type === "image" && !f.static) out[f.fieldKey] = photoPlaceholder;
    }
    return out;
  }, [template]);
  return (
    <div className="w-full h-full pointer-events-none">
      <ErrorBoundary
        level="canvas"
        context={{ templateId: template.id }}
        resetKeys={[template]}
        fallback={() => (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: "var(--bg-hover)" }}
          >
            <span style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
              Preview unavailable
            </span>
          </div>
        )}
      >
        <SchemaRenderer schema={template} values={values} brandKit={kit} instrument={false} />
      </ErrorBoundary>
    </div>
  );
}
