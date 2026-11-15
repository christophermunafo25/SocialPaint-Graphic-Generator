import { describe, expect, it } from "vitest";
import type { FigmaNode } from "./extract.ts";
import { importFrame } from "./importFrame.ts";
import { portraitWithPlate, UNKEYED_NAMES } from "./intentFixtures.ts";

const byLabel = (root: FigmaNode) => {
  const out = importFrame(root);
  return {
    ...out,
    field: (label: string) => {
      const f = out.fields.find((x) => x.label === label);
      if (!f) throw new Error(`No field labeled ${label}: ${out.fields.map((x) => x.label)}`);
      return f;
    },
  };
};

describe("keys mapped onto the import", () => {
  it("labels every field from its role", () => {
    const { fields } = importFrame(portraitWithPlate());
    expect(fields.map((f) => f.label)).toEqual([
      "Photo",
      "Plate",
      "Headline",
      "Call to action",
      "Logo",
    ]);
    expect(fields.map((f) => f.fieldKey)).toEqual([
      "photo",
      "plate",
      "headline",
      "call_to_action",
      "logo",
    ]);
  });

  it("gives a mask group's photo the keys of the photo inside it", () => {
    const { field, intents } = byLabel(portraitWithPlate());
    const photo = field("Photo");
    expect(photo).toMatchObject({
      type: "image",
      sourceNodeId: "32:40",
      objectFit: "cover",
      maskNodeId: "32:41",
      fillImageRef: "photo-ref",
    });
    // A member field: it keeps its crop, its mask and (once the artwork
    // lands) its sample.
    expect(photo.static).toBeUndefined();
    expect(photo.imageRect).toBeDefined();
    expect(intents.find((i) => i.fieldId === photo.id)).toMatchObject({
      layer: "photo-fill · image · fit=cover · edit=member",
      declared: { role: "photo-fill", kind: "image", edit: "member", fit: "cover" },
    });
  });

  it("turns a member text field on the way the builder's switch does", () => {
    const { field } = byLabel(portraitWithPlate());
    const headline = field("Headline");
    expect(headline.static).toBeUndefined();
    expect(headline.staticValue).toBeUndefined();
    expect(headline.placeholder).toBe("Is it time to drop the naps?");
    expect(headline.textSizing).toBe("shrink");
    expect(headline.maxLength).toBe(32);
    expect(headline.align).toBe("left");
  });

  it("reads a fused pill's member keys from its text and its role from the container", () => {
    const { field, intents } = byLabel(portraitWithPlate());
    const cta = field("Call to action");
    expect(cta.plateColor).toBe("#F7BFA0");
    // The container says edit=fixed; the text inside says edit=member.
    expect(cta.static).toBeUndefined();
    expect(cta.maxLength).toBe(24);
    expect(cta.textSizing).toBe("shrink");
    expect(intents.find((i) => i.fieldId === cta.id)!.declared).toMatchObject({
      role: "cta",
      kind: "pill",
      fill: "card",
      text: "on-card",
      edit: "member",
      max: 24,
    });
  });

  it("keeps fixed layers fixed and records what a logo asks for", () => {
    const { field, intents } = byLabel(portraitWithPlate());
    expect(field("Plate")).toMatchObject({ type: "shape", static: true });
    const logo = field("Logo");
    expect(logo.static).toBe(true);
    expect(intents.find((i) => i.fieldId === logo.id)!.declared).toMatchObject({
      kind: "logo",
      variant: "primary",
      surface: "light",
      edit: "fixed",
    });
  });

  it("reports colour roles without storing them", () => {
    const { field, intents } = byLabel(portraitWithPlate());
    const plate = field("Plate");
    expect(plate.colorHex).toBe("#FFE0CF");
    expect(intents.find((i) => i.fieldId === plate.id)!.declared.fill).toBe("accent");
  });

  it("names a key that can't apply to its field instead of applying it", () => {
    const { field, intents } = byLabel(
      portraitWithPlate({ names: { plate: "plate · plate · fill=accent · edit=member · max=9" } }),
    );
    const plate = field("Plate");
    expect(plate.static).toBe(true);
    expect(plate.maxLength).toBeUndefined();
    expect(intents.find((i) => i.fieldId === plate.id)!.ignored).toEqual(["edit=member", "max=9"]);
  });

  it("numbers a role used more than once in reading order", () => {
    const { fields } = importFrame(
      portraitWithPlate({
        names: { pillText: "headline · text · edit=member · max=24", pill: "Frame 6" },
      }),
    );
    // The headline sits above the pill, so it is 1.
    expect(fields.map((f) => f.label)).toEqual([
      "Photo",
      "Plate",
      "Headline 1",
      "Headline 2",
      "Logo",
    ]);
    expect(new Set(fields.map((f) => f.fieldKey)).size).toBe(fields.length);
  });

  it("says once when a key isn't one it reads", () => {
    const { warnings, parse } = importFrame(
      portraitWithPlate({ names: { plate: "plate · plate · fill=accent · glow=soft" } }),
    );
    expect(parse.unknownKeys).toEqual(["glow (plate · plate · fill=accent · glow=soft)"]);
    expect(warnings).toContainEqual({
      layer: "plate · plate · fill=accent · glow=soft",
      nodeId: "",
      issue: `key "glow" isn't one this import reads, so it was kept in the report only.`,
      severity: "info",
    });
  });

  it("reports how much of the frame is keyed", () => {
    const { parse } = importFrame(portraitWithPlate());
    expect(parse).toMatchObject({ layers: 10, keyed: 6, unknownKinds: [], unknownKeys: [] });
  });
});

describe("an unkeyed frame", () => {
  it("lands as it did before: all fixed, labeled by layer name, no intents", () => {
    const { fields, intents, parse } = importFrame(portraitWithPlate({ names: UNKEYED_NAMES }));
    expect(intents).toEqual([]);
    expect(parse.keyed).toBe(0);
    expect(fields.map((f) => f.label)).toEqual([
      "Mask group",
      "Frame 7",
      "Is it time to drop the naps?",
      "Frame 6",
      "image 2",
    ]);
    expect(fields.every((f) => f.static === true)).toBe(true);
    expect(fields.every((f) => f.maxLength === undefined && f.textSizing === undefined)).toBe(true);
  });
});
