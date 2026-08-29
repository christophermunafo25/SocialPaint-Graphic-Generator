import { describe, expect, it } from "vitest";
import type { GeneratedDesign, TemplateField } from "../types";
import { designToSchema } from "./designToSchema";

const field = (over: Partial<TemplateField>): TemplateField => ({
  id: "f1",
  label: "Headline",
  fieldKey: "headline",
  type: "text",
  x: 100,
  y: 100,
  width: 800,
  height: 200,
  ...over,
});

describe("designToSchema", () => {
  const design: GeneratedDesign = {
    name: "Hiring card",
    canvasWidth: 1080,
    canvasHeight: 1350,
    backgroundColor: "#f4f1ea",
    captionTemplate: "Join us: {headline}",
    fields: [
      field({}),
      field({ id: "f2", fieldKey: "block", type: "shape", shape: "rect", static: true }),
    ],
  };

  it("assembles an ephemeral draft with provenance stamped", () => {
    const s = designToSchema(design, "co-1", 2, {
      model: "claude-x",
      generatedAt: "2026-08-28T00:00:00Z",
    });
    expect(s.id).toBe("freestyle-2");
    expect(s.companyId).toBe("co-1");
    // Draft until a save deliberately publishes it.
    expect(s.status).toBe("draft");
    expect(s.backgroundColor).toBe("#f4f1ea");
    expect(s.captionTemplate).toBe("Join us: {headline}");
    expect(s.fields).toHaveLength(2);
    expect(s.autobuildMeta).toEqual({
      model: "claude-x",
      sourceKind: "generate-freestyle",
      generatedAt: "2026-08-28T00:00:00Z",
      elementCount: 2,
      editableCount: 1,
    });
  });
});
