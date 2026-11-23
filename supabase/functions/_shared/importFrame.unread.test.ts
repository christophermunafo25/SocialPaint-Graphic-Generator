// A frame whose layer names can't be read still imports: the walk's fields
// land as if the frame had no keys, and the import says so once. The key
// pass is replaced here with one that fails part way through.
import { describe, expect, it, vi } from "vitest";
import type { FigmaNode, ImportWarning, SuggestedField } from "./extract.ts";

vi.mock("./frameIntent.ts", async (importOriginal) => {
  const original = await importOriginal<typeof import("./frameIntent.ts")>();
  return {
    ...original,
    applyFrameIntent: (_root: FigmaNode, fields: SuggestedField[], warnings: ImportWarning[]) => {
      fields[0].static = undefined;
      fields[0].label = "Half done";
      warnings.push({ layer: "Half done", nodeId: "", issue: "half said", severity: "info" });
      throw new Error("unreadable");
    },
  };
});

vi.mock("./http.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./http.ts")>()),
  logError: vi.fn(),
}));

import { importFrame } from "./importFrame.ts";
import { portraitWithPlate } from "./intentFixtures.ts";

describe("a frame whose keys can't be read", () => {
  it("imports as the walk made it, and says so", () => {
    const out = importFrame(portraitWithPlate());
    // Nothing of the failed pass is left: every field is fixed and labeled
    // by its layer name, as before this phase.
    expect(out.fields.map((f) => f.label)).toEqual([
      "Mask group",
      "plate · plate · fill=accent · edit=fixed",
      "headline · text · edit=member · max=32 · lines=3 · text=on-accent · align=left",
      "cta · pill · fill=card · edit=fixed",
      "logo · logo · variant=primary · surface=light · edit=fixed",
    ]);
    expect(out.fields.every((f) => f.static === true)).toBe(true);
    expect(out.intents).toEqual([]);
    expect(out.capTrim).toEqual([]);
    expect(out.parse.keyed).toBe(0);
    expect(out.warnings.map((w) => w.issue)).toEqual([
      "the keys in this frame's layer names couldn't be read, so it imported without them.",
    ]);
  });
});
