// A freestyle design as a renderable template. Ephemeral by design: it gets
// a synthetic id, is never written through templateStore, and dies with the
// page — SchemaRenderer, the measurement pass, and TemplateFill all take a
// TemplateSchema, so one assembly here buys every existing surface.

import type { GeneratedDesign, TemplateSchema } from "../types";

export function designToSchema(
  design: GeneratedDesign,
  companyId: string,
  ordinal: number,
): TemplateSchema {
  const now = new Date().toISOString();
  return {
    id: `freestyle-${ordinal}`,
    companyId,
    name: design.name,
    description: "",
    category: "",
    tags: [],
    // Draft: nothing downstream may mistake this for a published template.
    status: "draft",
    canvasWidth: design.canvasWidth,
    canvasHeight: design.canvasHeight,
    backgroundUrl: "",
    backgroundColor: design.backgroundColor,
    fields: design.fields,
    captionTemplate: "",
    createdAt: now,
    updatedAt: now,
  };
}
