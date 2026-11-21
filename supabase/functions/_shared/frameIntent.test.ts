import { describe, expect, it } from "vitest";
import type { FigmaNode } from "./extract.ts";
import { bandRoomOf, growthAnchorOf } from "./frameIntent.ts";
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

  it("keeps all of a member's copy as its placeholder, however long", () => {
    const copy =
      "Is it time to drop the naps? What sleep researchers tell the parents of toddlers who stop napping.";
    const root = portraitWithPlate({
      names: { headline: "headline · text · edit=member · align=left" },
    });
    const visit = (n: FigmaNode) => {
      if (n.id === "33:18") n.characters = copy;
      n.children?.forEach(visit);
    };
    visit(root);
    const headline = byLabel(root).field("Headline");
    expect(copy.length).toBeGreaterThan(80);
    expect(headline.static).toBeUndefined();
    expect(headline.placeholder).toBe(copy);
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

describe("layout intent", () => {
  it("draws a pill at its designed height when its text is cap-trimmed", () => {
    const { field } = byLabel(portraitWithPlate());
    const cta = field("Call to action");
    // 76 tall around one 39px line box: (76 - 39) / 2, not the 27 between
    // the container's top and the trimmed text box.
    expect(cta.platePaddingY).toBe(18.5);
    expect(cta.platePaddingX).toBe(44);
    expect(cta).toMatchObject({ x: 133, y: 1119, width: 359, height: 76 });
  });

  it("holds the left edge of a hug pill that leads a space-between row", () => {
    expect(byLabel(portraitWithPlate()).field("Call to action").align).toBe("left");
  });

  it("holds the right edge of a hug pill that ends a space-between row", () => {
    const { field } = byLabel(portraitWithPlate({ pillLast: true }));
    expect(field("Call to action").align).toBe("right");
  });

  it("follows the row's own packing", () => {
    const anchor = (rowAlign: "MIN" | "CENTER" | "MAX", pillLast = false) =>
      byLabel(portraitWithPlate({ rowAlign, pillLast })).field("Call to action").align;
    expect(anchor("MIN")).toBe("left");
    expect(anchor("MIN", true)).toBe("left");
    expect(anchor("CENTER")).toBe("center");
    expect(anchor("MAX")).toBe("right");
  });

  it("anchors an unkeyed pill too, since the layout says so either way", () => {
    const { fields } = importFrame(portraitWithPlate({ names: UNKEYED_NAMES }));
    const pill = fields.find((f) => f.plateColor)!;
    expect(pill.align).toBe("left");
    expect(pill.platePaddingY).toBe(18.5);
    expect(pill.static).toBe(true);
  });

  it("gives a member headline the band its plate leaves it", () => {
    const headline = byLabel(portraitWithPlate()).field("Headline");
    // Two lines grown back from the cap trim are 184.8 from 855.1. The
    // plate's inner top is 872 and the row below starts at 1119 less the 40
    // gap, so the band adds 56 below the drawn box.
    expect(headline).toMatchObject({
      x: 133,
      y: 855.1,
      width: 709,
      height: 240.8,
      verticalAlign: "top",
    });
  });

  it("leaves a fixed headline in the box it was drawn in", () => {
    const { fields } = importFrame(portraitWithPlate({ names: UNKEYED_NAMES }));
    const headline = fields.find((f) => f.sourceNodeId === "33:18")!;
    expect(headline).toMatchObject({ y: 855.1, height: 184.8, static: true });
  });

  it("adds no field for a wrapper group", () => {
    const { fields } = importFrame(portraitWithPlate());
    expect(fields.some((f) => f.sourceNodeId === "40:6" || f.sourceNodeId === "40:5")).toBe(false);
  });
});

describe("bandRoomOf and growthAnchorOf", () => {
  const node = (id: string, y: number, height: number, extra: object = {}) =>
    ({
      id,
      name: id,
      type: "FRAME",
      absoluteBoundingBox: { x: 0, y, width: 100, height },
      ...extra,
    }) as unknown as FigmaNode;
  const column = (align: string, kids: FigmaNode[], extra: object = {}) =>
    node("col", 0, 400, {
      layoutMode: "VERTICAL",
      primaryAxisSizingMode: "FIXED",
      primaryAxisAlignItems: align,
      paddingTop: 20,
      paddingBottom: 30,
      itemSpacing: 10,
      children: kids,
      ...extra,
    });

  it("gives the last child of a top-packed column the room beneath it", () => {
    const a = node("a", 20, 50);
    const b = node("b", 80, 100);
    const col = column("MIN", [a, b]);
    expect(bandRoomOf(b, col)).toEqual({ extra: 190, grows: "down" });
    // The first child has a sibling right under it: no room.
    expect(bandRoomOf(a, col)).toBeUndefined();
  });

  it("gives the first child of a bottom-packed column the room above it", () => {
    const a = node("a", 220, 50);
    const b = node("b", 280, 90);
    expect(bandRoomOf(a, column("MAX", [a, b]))).toEqual({ extra: 200, grows: "up" });
  });

  it("splits a space-between column at the gap", () => {
    const a = node("a", 20, 50);
    const b = node("b", 280, 90);
    const col = column("SPACE_BETWEEN", [a, b]);
    expect(bandRoomOf(a, col)).toEqual({ extra: 200, grows: "down" });
    expect(bandRoomOf(b, col)).toEqual({ extra: 200, grows: "up" });
  });

  it("gives nothing in a column that hugs, a row, or to a hand-placed child", () => {
    const a = node("a", 20, 50);
    expect(bandRoomOf(a, column("MIN", [a], { layoutSizingVertical: "HUG" }))).toBeUndefined();
    expect(bandRoomOf(a, column("MIN", [a], { layoutMode: "HORIZONTAL" }))).toBeUndefined();
    const placed = node("p", 20, 50, { layoutPositioning: "ABSOLUTE" });
    expect(bandRoomOf(placed, column("MIN", [placed]))).toBeUndefined();
    expect(growthAnchorOf(placed, column("MIN", [placed]))).toBeUndefined();
  });

  it("anchors by the cross axis in a column and not at all without auto layout", () => {
    const a = node("a", 20, 50);
    expect(growthAnchorOf(a, column("MIN", [a]))).toBe("left");
    expect(growthAnchorOf(a, column("MIN", [a], { counterAxisAlignItems: "CENTER" }))).toBe(
      "center",
    );
    expect(growthAnchorOf(a, column("MIN", [a], { counterAxisAlignItems: "MAX" }))).toBe("right");
    expect(growthAnchorOf(a, node("plain", 0, 400, { children: [a] }))).toBeUndefined();
  });
});
