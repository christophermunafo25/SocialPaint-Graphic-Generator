import React from "react";
import type { TemplateSchema } from "@/lib/types";
import { useBrand } from "@/lib/brand/BrandContext";
import { ErrorBoundary } from "./ErrorBoundary";
import { SchemaRenderer } from "./SchemaRenderer";

/** Card-sized live preview of a template (no usage instrumentation). One
 * template that can't render shows a quiet placeholder card; it must never
 * take the whole gallery grid down with it. */
export function TemplateThumbnail({ template }: { template: TemplateSchema }) {
  const { kit } = useBrand();
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
        <SchemaRenderer schema={template} values={{}} brandKit={kit} instrument={false} />
      </ErrorBoundary>
    </div>
  );
}
