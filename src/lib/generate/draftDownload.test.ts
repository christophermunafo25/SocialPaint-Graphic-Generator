import { describe, expect, it } from "vitest";
import type { GeneratedProposal, TemplateField, TemplateSchema } from "../types";
import { ExportAssetError } from "../render/exportPng";
import type { ChatDraft } from "./chat";
import {
  EXPORT_ERROR_GENERIC,
  busyDraftId,
  emptyQueue,
  enqueue,
  exportErrorMessage,
  hasDraft,
  instrumentsUsage,
  missingFields,
  settle,
  type DownloadJob,
} from "./draftDownload";

const schema = (over: Partial<TemplateSchema> = {}): TemplateSchema => ({
  id: "t1",
  companyId: "co-1",
  name: "Now hiring",
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: 1080,
  canvasHeight: 1350,
  backgroundUrl: "",
  fields: [],
  captionTemplate: "",
  createdAt: "2026-09-25T00:00:00Z",
  updatedAt: "2026-09-25T00:00:00Z",
  ...over,
});

const proposal = (over: Partial<GeneratedProposal> = {}): GeneratedProposal => ({
  templateId: "t1",
  templateName: "Now hiring",
  values: {},
  caption: "",
  why: "",
  imageFieldsNeeded: [],
  ...over,
});

const draft = (over: Partial<ChatDraft> = {}): ChatDraft => ({
  id: "d1",
  proposal: proposal(),
  schema: schema(),
  canvas: { width: 1080, height: 1350 },
  values: {},
  ...over,
});

const design = {
  name: "Now hiring (new)",
  canvasWidth: 1080,
  canvasHeight: 1350,
  backgroundColor: "#ffffff",
  captionTemplate: "",
  fields: [],
} as unknown as NonNullable<GeneratedProposal["design"]>;

const job = (id: number, draftId: string): DownloadJob => ({ id, draftId });

describe("instrumentsUsage", () => {
  it("records usage for a draft of a published library template", () => {
    expect(instrumentsUsage(draft())).toBe(true);
  });

  it("never records usage for a freestyle design", () => {
    const freestyle = draft({
      proposal: proposal({ templateId: "freestyle-1", design }),
      schema: schema({ id: "freestyle-1", status: "draft" }),
    });
    expect(instrumentsUsage(freestyle)).toBe(false);
  });

  it("never records usage for a design even if its schema claims to be published", () => {
    expect(instrumentsUsage(draft({ proposal: proposal({ design }) }))).toBe(false);
  });

  it("never records usage for a schema that is not published", () => {
    expect(instrumentsUsage(draft({ schema: schema({ status: "draft" }) }))).toBe(false);
  });

  it("never records usage for a draft whose template is gone", () => {
    expect(instrumentsUsage(draft({ schema: null }))).toBe(false);
  });
});

describe("exportErrorMessage", () => {
  it("shows an ExportAssetError's own message, which names the image", () => {
    const e = new ExportAssetError(
      "Couldn't load Headshot. The graphic would export with it missing.",
    );
    expect(exportErrorMessage(e)).toBe(
      "Couldn't load Headshot. The graphic would export with it missing.",
    );
  });

  it("keeps any other error behind TemplateFill's generic line", () => {
    expect(exportErrorMessage(new Error("Canvas not mounted"))).toBe(EXPORT_ERROR_GENERIC);
    expect(exportErrorMessage("boom")).toBe(EXPORT_ERROR_GENERIC);
    expect(exportErrorMessage(undefined)).toBe(EXPORT_ERROR_GENERIC);
  });

  it("never puts an em dash in front of the member", () => {
    expect(EXPORT_ERROR_GENERIC).not.toContain("—");
  });
});

describe("the download queue", () => {
  it("starts the first export at once", () => {
    const q = enqueue(emptyQueue(), job(1, "a"));
    expect(q.active).toEqual(job(1, "a"));
    expect(q.waiting).toEqual([]);
    expect(busyDraftId(q)).toBe("a");
  });

  it("is idle, and no draft is busy, when empty", () => {
    expect(busyDraftId(emptyQueue())).toBeNull();
  });

  it("runs one export at a time: another draft waits its turn, in order", () => {
    let q = enqueue(emptyQueue(), job(1, "a"));
    q = enqueue(q, job(2, "b"));
    q = enqueue(q, job(3, "c"));
    expect(busyDraftId(q)).toBe("a");
    expect(q.waiting.map((j) => j.draftId)).toEqual(["b", "c"]);

    q = settle(q, 1);
    expect(busyDraftId(q)).toBe("b");
    q = settle(q, 2);
    expect(busyDraftId(q)).toBe("c");
    q = settle(q, 3);
    expect(q).toEqual(emptyQueue());
  });

  it("never queues a draft twice, whether it is exporting or waiting", () => {
    const running = enqueue(emptyQueue(), job(1, "a"));
    expect(enqueue(running, job(2, "a"))).toBe(running);

    const waiting = enqueue(running, job(2, "b"));
    expect(enqueue(waiting, job(3, "b"))).toBe(waiting);
    expect(hasDraft(waiting, "a")).toBe(true);
    expect(hasDraft(waiting, "b")).toBe(true);
    expect(hasDraft(waiting, "c")).toBe(false);
  });

  it("takes the same draft again once its export has finished", () => {
    let q = enqueue(emptyQueue(), job(1, "a"));
    q = settle(q, 1);
    q = enqueue(q, job(2, "a"));
    expect(q.active).toEqual(job(2, "a"));
  });

  it("ignores a report for anything but the active export", () => {
    let q = enqueue(emptyQueue(), job(1, "a"));
    q = enqueue(q, job(2, "b"));
    // A late or repeated report must not skip the waiting export.
    expect(settle(q, 2)).toBe(q);
    expect(settle(q, 99)).toBe(q);
    const next = settle(q, 1);
    expect(settle(next, 1)).toBe(next);
    expect(busyDraftId(next)).toBe("b");
  });
});

describe("missingFields", () => {
  const field = (over: Partial<TemplateField>): TemplateField => ({
    id: over.fieldKey ?? "f",
    label: "Headline",
    fieldKey: "headline",
    type: "text",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...over,
  });
  const fields = [
    field({ fieldKey: "headline", label: "Headline" }),
    field({ fieldKey: "tagline", label: "Tagline", static: true, staticValue: "Since 1990" }),
    field({ fieldKey: "bar", label: "Bar", type: "shape", static: true }),
    field({ fieldKey: "photo", label: "Photo", type: "image" }),
    field({ fieldKey: "logo", label: "Partner logo", type: "image" }),
    field({ fieldKey: "mode", label: "Mode", type: "select", options: ["A", "B"] }),
  ];
  const d = draft({ schema: schema({ fields }) });
  const keys = (values: Record<string, string>) => missingFields(d, values).map((f) => f.fieldKey);

  it("lists every required field left empty, in form order, as the fill page does", () => {
    expect(keys({})).toEqual(["headline", "photo", "logo", "mode"]);
    expect(keys({ headline: "Now hiring", mode: "A" })).toEqual(["photo", "logo"]);
  });

  it("counts the photo's slot as filled when the values carry it", () => {
    expect(
      keys({ headline: "Now hiring", mode: "A", photo: "data:image/png;base64,AAAA" }),
    ).toEqual(["logo"]);
  });

  it("is empty once every required field has a value", () => {
    expect(keys({ headline: "x", photo: "data:x", logo: "data:y", mode: "B" })).toEqual([]);
  });

  it("never lists fixed elements or shapes", () => {
    expect(keys({})).not.toContain("tagline");
    expect(keys({})).not.toContain("bar");
  });

  it("lists a repeated fieldKey once", () => {
    const twice = draft({
      schema: schema({
        fields: [field({ id: "first" }), field({ id: "dup", label: "Headline again" })],
      }),
    });
    expect(missingFields(twice, {}).map((f) => f.id)).toEqual(["first"]);
  });

  it("has nothing to list for a draft whose template is gone", () => {
    expect(missingFields(draft({ schema: null }), {})).toEqual([]);
  });
});
