import { describe, expect, it } from "vitest";
import { declaredIntentOf, parseLayerName, parseTree, roleLabel } from "./recipe.ts";

describe("parseLayerName", () => {
  it("reads role, kind and keys", () => {
    const p = parseLayerName(
      "headline · text · edit=member · max=32 · lines=3 · text=on-accent · align=left",
    )!;
    expect(p.role).toBe("headline");
    expect(p.kind).toBe("text");
    expect(p.keys).toEqual({
      edit: "member",
      max: "32",
      lines: "3",
      text: "on-accent",
      align: "left",
    });
    expect(p.knownKind).toBe(true);
    expect(p.unknownKeys).toEqual([]);
  });

  it("reads a role and kind with no keys", () => {
    expect(parseLayerName("content · group")).toMatchObject({
      role: "content",
      kind: "group",
      keys: {},
    });
  });

  it("keeps values that carry spaces", () => {
    const p = parseLayerName(
      "photo · group · subject=physician headshot · crop=head-and-shoulders · shape=arch · fit=cover · edit=member",
    )!;
    expect(p.keys.subject).toBe("physician headshot");
    expect(p.keys.crop).toBe("head-and-shoulders");
  });

  it("tolerates uneven spacing around the dots", () => {
    expect(parseLayerName("cta·pill ·  fill=card ·edit=fixed")).toMatchObject({
      role: "cta",
      kind: "pill",
      keys: { fill: "card", edit: "fixed" },
    });
  });

  it("treats Figma's default names and ordinary names as unkeyed", () => {
    for (const name of [
      "Mask group",
      "Rectangle 1",
      "Group 8",
      "Frame 8",
      "Star 3",
      "Is it time to drop the naps?",
      "Sign in · Light",
      "P15 · Topic · Portrait with plate",
      "price · monthly",
      "",
    ]) {
      expect(parseLayerName(name), name).toBeNull();
    }
  });

  it("keeps an unknown kind when a key comes with it, and names it", () => {
    const p = parseLayerName("burst · confetti · edit=fixed")!;
    expect(p.kind).toBe("confetti");
    expect(p.knownKind).toBe(false);
  });

  it("keeps unknown keys and stray segments, and lists them", () => {
    const p = parseLayerName("headline · text · edit=member · tone=warm · big")!;
    expect(p.keys.tone).toBe("warm");
    expect(p.unknownKeys).toEqual(["tone"]);
    expect(p.stray).toEqual(["big"]);
  });
});

describe("declaredIntentOf", () => {
  it("types the values an import applies", () => {
    const d = declaredIntentOf(
      parseLayerName("headline · text · edit=member · max=32 · lines=3 · align=left")!,
    );
    expect(d).toEqual({
      role: "headline",
      kind: "text",
      edit: "member",
      max: 32,
      lines: 3,
      align: "left",
      invalid: [],
    });
  });

  it("carries colour roles and logo keys as written", () => {
    expect(
      declaredIntentOf(parseLayerName("plate · plate · fill=accent · edit=fixed")!),
    ).toMatchObject({ fill: "accent", edit: "fixed" });
    expect(
      declaredIntentOf(
        parseLayerName("logo · logo · variant=primary · surface=light · edit=fixed")!,
      ),
    ).toMatchObject({ variant: "primary", surface: "light" });
  });

  it("leaves out a value a key doesn't take, and names it", () => {
    const d = declaredIntentOf(
      parseLayerName("headline · text · edit=maybe · max=lots · lines=0 · align=justify")!,
    );
    expect(d.edit).toBeUndefined();
    expect(d.max).toBeUndefined();
    expect(d.lines).toBeUndefined();
    expect(d.align).toBeUndefined();
    expect(d.invalid).toEqual(["edit=maybe", "max=lots", "lines=0", "align=justify"]);
  });
});

describe("roleLabel", () => {
  it("reads a role as a sentence-case label", () => {
    expect(roleLabel("headline")).toBe("Headline");
    expect(roleLabel("photo-fill")).toBe("Photo");
    expect(roleLabel("photo-shape")).toBe("Photo");
    expect(roleLabel("divider-tag")).toBe("Divider tag");
    expect(roleLabel("tag-a")).toBe("Tag a");
    expect(roleLabel("cta")).toBe("Call to action");
    // A known role keeps its label behind a build suffix.
    expect(roleLabel("cta-text")).toBe("Call to action");
    expect(roleLabel("logo")).toBe("Logo");
  });
});

describe("parseTree", () => {
  it("counts visible layers under the root and what it didn't know", () => {
    const report = parseTree({
      name: "P15 · Topic · Portrait with plate",
      children: [
        {
          name: "Mask group",
          children: [
            { name: "Rectangle 1" },
            { name: "photo-fill · image · fit=cover · edit=member" },
          ],
        },
        { name: "plate · plate · fill=accent · edit=fixed · glow=soft" },
        { name: "burst · confetti · edit=fixed" },
        { name: "headline · text · max=lots" },
        { name: "hidden · text · edit=member", visible: false },
      ],
    });
    expect(report.layers).toBe(6);
    expect(report.keyed).toBe(4);
    expect(report.kinds).toEqual({ image: 1, plate: 1, confetti: 1, text: 1 });
    expect(report.unknownKinds).toEqual(["confetti (burst · confetti · edit=fixed)"]);
    expect(report.unknownKeys).toEqual([
      "glow (plate · plate · fill=accent · edit=fixed · glow=soft)",
    ]);
    expect(report.invalid).toEqual(["max=lots (headline · text · max=lots)"]);
  });
});
