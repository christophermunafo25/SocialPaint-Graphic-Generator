import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import type { TemplateField, TemplateSchema } from "../types";
import type { RowCheck } from "./validate";
import { captionsCsv, rowFileName, runBulk, slugify } from "./run";

let nextId = 0;
const mkField = (over: Partial<TemplateField>): TemplateField => ({
  id: `f${nextId++}`,
  label: over.label ?? "Field",
  fieldKey: over.fieldKey ?? `field_${nextId}`,
  type: "text",
  x: 0,
  y: 0,
  width: 400,
  height: 100,
  ...over,
});

const schema = (over: Partial<TemplateSchema> = {}): TemplateSchema => ({
  id: "tpl",
  companyId: "co",
  name: "Speaker card",
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: 1080,
  canvasHeight: 1080,
  backgroundUrl: "",
  captionTemplate: "{name} on {headline}",
  fields: [
    mkField({ fieldKey: "name", label: "Name" }),
    mkField({ fieldKey: "headline", label: "Headline" }),
  ],
  createdAt: "",
  updatedAt: "",
  ...over,
});

const check = (index: number, values: Record<string, string>): RowCheck => ({
  index,
  values,
  problems: [],
  ok: true,
});

/** A stub renderer: the "PNG" is the row's name as bytes, so the archive
 * can be read back and each entry traced to its row. */
const fakeRender = async (values: Record<string, string>) =>
  new Blob([`png:${values.name}`], { type: "image/png" });

const never = new AbortController().signal;
const noProgress = () => {};

async function entries(zip: Blob) {
  const z = await JSZip.loadAsync(await zip.arrayBuffer());
  const out: Record<string, string> = {};
  for (const name of Object.keys(z.files).sort()) out[name] = await z.files[name].async("string");
  return out;
}

describe("slugify", () => {
  it("lowercases, collapses runs, trims, and caps", () => {
    expect(slugify("  Grace  Hopper, PhD! ")).toBe("grace-hopper-phd");
    expect(slugify("x".repeat(50))).toHaveLength(40);
    expect(slugify("a".repeat(39) + "-b")).toBe("a".repeat(39));
    expect(slugify("---")).toBe("");
  });
});

describe("rowFileName", () => {
  it("leads with the zero-padded row number and uses the first text value", () => {
    expect(rowFileName(schema(), 0, { name: "Ada Lovelace", headline: "x" }, 3)).toBe(
      "001-ada-lovelace.png",
    );
    expect(rowFileName(schema(), 41, { name: "Ada" }, 2)).toBe("42-ada.png");
  });

  it("skips an empty first field and falls back to the template name", () => {
    expect(rowFileName(schema(), 0, { name: "", headline: "Compilers" }, 1)).toBe(
      "1-compilers.png",
    );
    expect(rowFileName(schema(), 0, {}, 1)).toBe("1-speaker-card.png");
    expect(rowFileName(schema({ name: "" }), 0, {}, 1)).toBe("1-graphic.png");
  });

  it("ignores select and static fields when choosing the slug", () => {
    const s = schema({
      fields: [
        mkField({ fieldKey: "brand", type: "text", static: true, staticValue: "SP" }),
        mkField({ fieldKey: "city", type: "select", options: ["Chicago"] }),
        mkField({ fieldKey: "name" }),
      ],
    });
    expect(rowFileName(s, 0, { city: "Chicago", name: "Ada" }, 1)).toBe("1-ada.png");
  });
});

describe("captionsCsv", () => {
  it("writes a header and quotes only what needs quoting", () => {
    const csv = captionsCsv([
      { row: 1, filename: "1-ada.png", caption: "plain" },
      { row: 2, filename: "2-grace.png", caption: 'Says "hi", then\nleaves' },
    ]);
    expect(csv).toBe(
      'row,filename,caption\r\n1,1-ada.png,plain\r\n2,2-grace.png,"Says ""hi"", then\nleaves"\r\n',
    );
  });
});

describe("runBulk", () => {
  it("renders every row into NNN-slug.png entries plus captions.csv", async () => {
    const checks = [
      check(0, { name: "Ada Lovelace", headline: "Engines" }),
      check(1, { name: "Grace Hopper", headline: "Compilers" }),
    ];
    const progress: Array<[number, number]> = [];
    const result = await runBulk({
      schema: schema(),
      checks,
      render: fakeRender,
      onProgress: (d, t) => progress.push([d, t]),
      signal: never,
    });
    expect(result.rendered).toBe(2);
    expect(result.failed).toEqual([]);
    expect(result.zip.type).toBe("application/zip");
    expect(progress).toEqual([
      [1, 2],
      [2, 2],
    ]);
    expect(await entries(result.zip)).toEqual({
      "1-ada-lovelace.png": "png:Ada Lovelace",
      "2-grace-hopper.png": "png:Grace Hopper",
      "captions.csv":
        "row,filename,caption\r\n1,1-ada-lovelace.png,Ada Lovelace on Engines\r\n2,2-grace-hopper.png,Grace Hopper on Compilers\r\n",
    });
  });

  it("pads the index to the width of the largest row number", async () => {
    const checks = [check(0, { name: "a" }), check(11, { name: "b" })];
    const result = await runBulk({
      schema: schema(),
      checks,
      render: fakeRender,
      onProgress: noProgress,
      signal: never,
    });
    expect(Object.keys(await entries(result.zip)).sort()).toEqual([
      "01-a.png",
      "12-b.png",
      "captions.csv",
    ]);
  });

  it("fails one row, keeps the rest, and leaves the failure out of captions", async () => {
    const checks = [
      check(0, { name: "ok" }),
      check(1, { name: "bad" }),
      check(2, { name: "fine" }),
    ];
    const render = async (values: Record<string, string>) => {
      if (values.name === "bad") throw new Error("Couldn't load the photo");
      return fakeRender(values);
    };
    const result = await runBulk({
      schema: schema(),
      checks,
      render,
      onProgress: noProgress,
      signal: never,
    });
    expect(result.rendered).toBe(2);
    expect(result.failed).toEqual([{ index: 1, message: "Couldn't load the photo" }]);
    const files = await entries(result.zip);
    expect(Object.keys(files).sort()).toEqual(["1-ok.png", "3-fine.png", "captions.csv"]);
    expect(files["captions.csv"]).not.toContain("bad");
  });

  it("stops between rows on abort and resolves with what was rendered", async () => {
    const controller = new AbortController();
    const checks = [
      check(0, { name: "one" }),
      check(1, { name: "two" }),
      check(2, { name: "three" }),
    ];
    const render = async (values: Record<string, string>) => {
      if (values.name === "two") controller.abort();
      return fakeRender(values);
    };
    const result = await runBulk({
      schema: schema(),
      checks,
      render,
      onProgress: noProgress,
      signal: controller.signal,
    });
    // Row two had started, so it finishes; row three never starts.
    expect(result.rendered).toBe(2);
    expect(result.failed).toEqual([]);
    expect(Object.keys(await entries(result.zip)).sort()).toEqual([
      "1-one.png",
      "2-two.png",
      "captions.csv",
    ]);
  });

  it("produces an archive with only captions.csv for an empty run", async () => {
    const result = await runBulk({
      schema: schema(),
      checks: [],
      render: fakeRender,
      onProgress: noProgress,
      signal: never,
    });
    expect(result.rendered).toBe(0);
    expect(await entries(result.zip)).toEqual({ "captions.csv": "row,filename,caption\r\n" });
  });
});
