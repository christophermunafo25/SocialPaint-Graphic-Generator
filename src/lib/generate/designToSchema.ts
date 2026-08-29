// A freestyle design as a renderable template. Ephemeral until an admin
// saves it: it gets a synthetic id and dies with the page — but it is
// assembled as a COMPLETE TemplateSchema, provenance included, so saving it
// to the library is nothing more than templateStore.create with the
// synthetic identity stripped. SchemaRenderer, the measurement pass, and
// TemplateFill all take a TemplateSchema, so one assembly here buys every
// existing surface.

import type { AutoBuildMeta, GeneratedDesign, TemplateSchema } from "../types";

export function designToSchema(
  design: GeneratedDesign,
  companyId: string,
  ordinal: number,
  provenance: { model: string; generatedAt: string },
): TemplateSchema {
  const now = new Date().toISOString();
  // The product's stated position: every AI-built template can answer which
  // model made it and when — same meta autobuild stamps, different source.
  const autobuildMeta: AutoBuildMeta = {
    model: provenance.model,
    sourceKind: "generate-freestyle",
    generatedAt: provenance.generatedAt,
    elementCount: design.fields.length,
    editableCount: design.fields.filter((f) => !f.static).length,
  };
  return {
    id: `freestyle-${ordinal}`,
    companyId,
    name: design.name,
    description: "",
    category: "",
    tags: [],
    // Draft: nothing downstream may mistake the EPHEMERAL copy for a
    // published template. Saving to the library sets its own status.
    status: "draft",
    canvasWidth: design.canvasWidth,
    canvasHeight: design.canvasHeight,
    backgroundUrl: "",
    backgroundColor: design.backgroundColor,
    fields: design.fields,
    captionTemplate: design.captionTemplate,
    autobuildMeta,
    createdAt: now,
    updatedAt: now,
  };
}
