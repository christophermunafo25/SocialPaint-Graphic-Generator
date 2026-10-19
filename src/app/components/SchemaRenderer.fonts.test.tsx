import React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateSchema } from "@/lib/types";

// Counts how many measurers the renderer builds: each one is a fresh layout
// generation, so a new one after a font lands is what "re-measured" means.
const measurers = vi.hoisted(() => ({ created: 0 }));
vi.mock("@/lib/render/autoFit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/render/autoFit")>();
  return {
    ...actual,
    createCanvasMeasurer: () => {
      measurers.created += 1;
      return (text: string, font: string) => text.length * 0.58 * (parseFloat(font) || 16);
    },
  };
});

import { SchemaRenderer } from "./SchemaRenderer";

const schema = (family: string): TemplateSchema => ({
  id: "t1",
  companyId: "c1",
  name: "Feature highlight",
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: 1080,
  canvasHeight: 1080,
  backgroundUrl: "",
  fields: [
    {
      id: "f1",
      label: "Headline",
      fieldKey: "headline",
      type: "text",
      x: 80,
      y: 80,
      width: 900,
      height: 300,
      fontFamily: family,
      fontWeight: 700,
    },
  ],
  captionTemplate: "",
  createdAt: "",
  updatedAt: "",
});

/** A document.fonts whose `ready` has ALREADY resolved — the race: the
 * document's fonts settle before the schema's stylesheet is even injected. */
function stubFonts() {
  const target = new EventTarget();
  const fonts = Object.assign(target, {
    ready: Promise.resolve(),
    load: vi.fn(async () => []),
    check: vi.fn(() => true),
  });
  Object.defineProperty(document, "fonts", { configurable: true, value: fonts });
  return fonts;
}

/** css2 stylesheets the renderer injected. Captured instead of attached, so
 * the test (not the network) decides when each one "arrives". */
let sheets: HTMLLinkElement[] = [];
const sheetFor = (family: string) =>
  sheets.find((l) => l.href.includes(`family=${family.replace(/ /g, "+")}`));

class NoopResizeObserver {
  observe() {}
  disconnect() {}
}

describe("SchemaRenderer font re-measure", () => {
  beforeEach(() => {
    measurers.created = 0;
    vi.stubGlobal("ResizeObserver", NoopResizeObserver);
    sheets = [];
    const append = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, "appendChild").mockImplementation(<T extends Node>(node: T): T => {
      if (node instanceof HTMLLinkElement) {
        sheets.push(node);
        return node;
      }
      return append(node);
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("re-measures when the schema's own stylesheet lands after fonts.ready", async () => {
    const fonts = stubFonts();
    render(
      <SchemaRenderer
        schema={schema("Racefont One")}
        values={{}}
        brandKit={null}
        instrument={false}
      />,
    );
    await act(async () => {});
    const sheet = sheetFor("Racefont One");
    expect(sheet).toBeDefined();
    const before = measurers.created;
    // The faces are not waited on until their stylesheet has arrived —
    // document.fonts.load resolves empty while it is in flight.
    expect(fonts.load).not.toHaveBeenCalled();

    await act(async () => {
      sheet!.dispatchEvent(new Event("load"));
    });
    expect(fonts.load).toHaveBeenCalledWith(expect.stringContaining('"Racefont One"'));
    expect(measurers.created).toBeGreaterThan(before);
  });

  it("re-measures when any face finishes loading later", async () => {
    const fonts = stubFonts();
    render(
      <SchemaRenderer
        schema={schema("Racefont Two")}
        values={{}}
        brandKit={null}
        instrument={false}
      />,
    );
    await act(async () => {});
    const before = measurers.created;
    await act(async () => {
      fonts.dispatchEvent(new Event("loadingdone"));
    });
    expect(measurers.created).toBeGreaterThan(before);
  });
});
