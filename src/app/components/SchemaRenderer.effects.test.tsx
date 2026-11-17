import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FieldEffect, TemplateField } from "@/lib/types";
import { DEFAULT_FILL_HEX, FieldBoxContent } from "./SchemaRenderer";

/** One pixel. A data URL paints at once, with no fetch. */
const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const CROP = { x: -0.3, y: -0.4, width: 1.6, height: 1.6 };
const DROP_SHADOW: FieldEffect = {
  type: "dropShadow",
  x: 8,
  y: 12,
  blur: 24,
  color: DEFAULT_FILL_HEX,
};
const LAYER_BLUR: FieldEffect = { type: "layerBlur", radius: 8 };
/** An inner shadow with no blur: its frame carries no filter of its own. */
const HARD_INNER_SHADOW: FieldEffect = {
  type: "innerShadow",
  x: 0,
  y: 6,
  blur: 0,
  spread: 6,
  color: DEFAULT_FILL_HEX,
};

const photo = (over: Partial<TemplateField>): TemplateField => ({
  id: "f1",
  label: "Photo",
  fieldKey: "photo",
  type: "image",
  x: 0,
  y: 0,
  width: 280,
  height: 280,
  objectFit: "cover",
  cornerRadius: { tl: 40, tr: 40, br: 40, bl: 40 },
  ...over,
});

/** The field's content as the canvas, the builder and the export draw it:
 * the outermost element, the box that clips the photo, and the photo. */
function renderPhoto(field: TemplateField) {
  const { container } = render(<FieldBoxContent field={field} value={PHOTO} brandKit={null} />);
  const root = container.firstElementChild as HTMLElement;
  const box = container.querySelector<HTMLElement>("[data-field-label]")!;
  const image = box.querySelector<HTMLImageElement>("img")!;
  return { root, box, image };
}

// Safari before 26 draws a positioned descendant of a filtered element with
// no clip unless it paints inside a clipping stacking context (WebKit bug
// 219520). No fidelity row can see that: the harness's WebKit is 26. These
// tests hold the markup that keeps a crop and an inner shadow inside the
// photo's frame there.
describe("an image field's clipping box under an effects wrapper", () => {
  it("is a stacking context under a drop shadow, with the crop inside it", () => {
    const { root, box, image } = renderPhoto(photo({ imageRect: CROP, effects: [DROP_SHADOW] }));
    expect(root.style.filter).toContain("drop-shadow(");
    expect(box.parentElement).toBe(root);
    expect(box.style.overflow).toBe("hidden");
    expect(box.style.isolation).toBe("isolate");
    // The crop is the positioned layer Safari would otherwise paint whole.
    expect(image.style.position).toBe("absolute");
    expect(image.parentElement).toBe(box);
  });

  it("is a stacking context under a layer blur", () => {
    const { root, box } = renderPhoto(photo({ imageRect: CROP, effects: [LAYER_BLUR] }));
    expect(root.style.filter).toContain("blur(");
    expect(box.parentElement).toBe(root);
    expect(box.style.isolation).toBe("isolate");
  });

  it("holds an unblurred inner shadow's frame inside the same stacking context", () => {
    const { root, box } = renderPhoto(photo({ effects: [DROP_SHADOW, HARD_INNER_SHADOW] }));
    expect(root.style.filter).toContain("drop-shadow(");
    expect(box.style.isolation).toBe("isolate");
    const overlay = box.lastElementChild as HTMLElement;
    expect(overlay.style.overflow).toBe("hidden");
    // With no blur the frame has no filter of its own, so it is one more
    // positioned layer Safari would paint whole under the wrapper.
    const frame = overlay.firstElementChild as HTMLElement;
    expect(frame.style.position).toBe("absolute");
    expect(frame.style.filter).toBe("");
  });

  it("keeps a field with no effects on the markup it had: one box, no wrapper", () => {
    const { root, box, image } = renderPhoto(photo({ imageRect: CROP }));
    expect(box).toBe(root);
    expect(box.style.isolation).toBe("");
    expect(box.style.filter).toBe("");
    expect(image.style.position).toBe("absolute");
  });
});
