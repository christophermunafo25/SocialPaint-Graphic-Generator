import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateSchema } from "../types";

// The snapshot itself (html-to-image's DOM clone) and the font work are
// stood in for; what is under test is when the snapshot image is drawn.
const snapshot = vi.hoisted(() => ({ made: 0 }));
vi.mock("html-to-image", () => ({
  toSvg: vi.fn(async () => {
    snapshot.made += 1;
    return "data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E";
  }),
}));
vi.mock("./fonts", () => ({
  ensureSchemaFontsLoaded: vi.fn(async () => undefined),
  buildExportFontEmbedCss: vi.fn(async () => undefined),
}));

import { renderSchemaBlob } from "./exportPng";

/** Firefox's nglayout.initialpaint.delay: how long a new document, the
 * snapshot image's included, paints nothing that is clipped to text. */
const FIREFOX_PAINT_SUPPRESSION_MS = 5;

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const schema = {
  name: "Launch",
  canvasWidth: 1080,
  canvasHeight: 1350,
} as TemplateSchema;

/** A canvas node with every image embedded: nothing loading, nothing failed. */
const node = {
  querySelector: () => null,
  querySelectorAll: () => [],
} as unknown as HTMLElement;

class FakeImage {
  static made: FakeImage[] = [];
  static fails = false;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = "";
  decoding = "";
  loaded = false;
  set src(_url: string) {
    FakeImage.made.push(this);
    queueMicrotask(() => {
      if (FakeImage.fails) return this.onerror?.();
      this.loaded = true;
      this.onload?.();
    });
  }
  decode() {
    return Promise.resolve();
  }
}

interface Draw {
  image: FakeImage;
  size: [number, number];
}

describe("renderSchemaBlob", () => {
  let draws: Draw[];

  beforeEach(() => {
    draws = [];
    snapshot.made = 0;
    FakeImage.made = [];
    FakeImage.fails = false;
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("document", {
      createElement: () => {
        const canvas = {
          width: 0,
          height: 0,
          getContext: () => ({
            drawImage: (image: FakeImage) => {
              draws.push({ image, size: [canvas.width, canvas.height] });
            },
          }),
          toDataURL: () => PNG,
        };
        return canvas;
      },
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("leaves the loaded snapshot undrawn through Firefox's paint suppression", async () => {
    const rendering = renderSchemaBlob(schema, node, null);

    // Loaded and decoded, with every microtask and zero-delay timer run:
    // still no draw. The first one waits on a timer no shorter than
    // Firefox's, because only that is sure to fire after it.
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeImage.made).toHaveLength(1);
    expect(FakeImage.made[0].loaded).toBe(true);
    expect(draws).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(FIREFOX_PAINT_SUPPRESSION_MS - 1);
    expect(draws).toHaveLength(0);

    await vi.runAllTimersAsync();
    const blob = await rendering;
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("draws one snapshot twice at the schema's size", async () => {
    const rendering = renderSchemaBlob(schema, node, null);
    await vi.runAllTimersAsync();
    await rendering;

    // One clone and one image, drawn twice. A second snapshot would be a
    // new document with a suppression window of its own.
    expect(snapshot.made).toBe(1);
    expect(FakeImage.made).toHaveLength(1);
    expect(draws).toEqual([
      { image: FakeImage.made[0], size: [1080, 1350] },
      { image: FakeImage.made[0], size: [1080, 1350] },
    ]);
  });

  it("rejects when the snapshot does not load", async () => {
    FakeImage.fails = true;
    const rendering = renderSchemaBlob(schema, node, null);
    const failed = expect(rendering).rejects.toThrow("snapshot");
    await vi.runAllTimersAsync();
    await failed;
    expect(draws).toHaveLength(0);
  });
});
