// The template chat's stand-in on the local backend (PHASE-4.md §9 D2).

import { afterEach, describe, expect, it, vi } from "vitest";
import type { TemplateField, TemplateSchema } from "../../types";
import { LocalGenerateProvider } from "./localStores";
import {
  STAND_IN_QUESTION,
  STAND_IN_REFUSAL,
  standInGenerate,
  standInRepair,
  standInValues,
} from "./templateChatStandIn";

const T0 = "2026-10-04T10:00:00.000Z";

const field = (fieldKey: string, over: Partial<TemplateField> = {}): TemplateField => ({
  id: fieldKey,
  label: fieldKey,
  fieldKey,
  type: "text",
  x: 0,
  y: 0,
  width: 400,
  height: 60,
  ...over,
});

const TEMPLATE: TemplateSchema = {
  id: "tpl-1",
  companyId: "co-1",
  name: "Product launch",
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: 1080,
  canvasHeight: 1350,
  backgroundUrl: "",
  fields: [
    field("kicker", { static: true, staticValue: "Acme" }),
    field("image", { type: "image", label: "Product image", placeholder: "Add a product image" }),
    field("eyebrow", { placeholder: "Now available" }),
    field("headline", { type: "multiline", placeholder: "The thing is here." }),
    field("cta", { placeholder: "Read the announcement", optional: true }),
    field("tier", { type: "select", options: ["Pro", "Team"] }),
  ],
  captionTemplate: "{headline} {cta}",
  createdAt: T0,
  updatedAt: T0,
};

/** A landscape template (X's 1600 × 900) beside the portrait one. */
const WIDE: TemplateSchema = {
  ...TEMPLATE,
  id: "tpl-2",
  name: "Open role",
  canvasWidth: 1600,
  canvasHeight: 900,
};
const loaders = {
  get: async (id: string) => [TEMPLATE, WIDE].find((t) => t.id === id) ?? null,
  listPublished: async (companyId: string) =>
    companyId === "co-1" ? [TEMPLATE, WIDE] : ([] as TemplateSchema[]),
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** Runs a build past the stand-in's delay. */
async function build(input: Parameters<typeof standInGenerate>[1]) {
  vi.useFakeTimers();
  const pending = standInGenerate("co-1", input, loaders);
  await vi.runAllTimersAsync();
  return pending;
}

describe("standInValues", () => {
  it("fills member text fields from their placeholders and leaves images and static fields", () => {
    expect(standInValues(TEMPLATE, { brief: "x", templateIdHint: "tpl-1" })).toEqual({
      eyebrow: "Now available",
      headline: "The thing is here.",
      cta: "Read the announcement",
      tier: "Pro",
    });
  });

  it("applies the member's details verbatim over the placeholders", () => {
    const values = standInValues(TEMPLATE, {
      brief: "x",
      templateIdHint: "tpl-1",
      details: [
        { fieldKey: "headline", value: "  Meet Acme Pro  " },
        { fieldKey: "image", value: "never" },
      ],
    });
    expect(values.headline).toBe("  Meet Acme Pro  ");
    expect(values).not.toHaveProperty("image");
  });

  it("puts Generate's facts into the fields that read as their kind", () => {
    const events: TemplateSchema = {
      ...TEMPLATE,
      fields: [
        ...TEMPLATE.fields,
        field("when", { label: "Event date" }),
        field("rsvp", { label: "RSVP link", maxLength: 10 }),
      ],
    };
    const values = standInValues(events, {
      brief: "x",
      facts: [
        { kind: "headline", value: "Spring open house" },
        { kind: "date", value: "Saturday" },
        { kind: "place", value: "Denver" },
        { kind: "link", value: "example.com/rsvp" },
      ],
    });
    expect(values.headline).toBe("Spring open house");
    expect(values.when).toBe("Saturday");
    expect(values.rsvp).toBe("example.co");
    // No field reads as a place, so the location goes nowhere.
    expect(Object.values(values)).not.toContain("Denver");
  });

  it("keeps a follow-up's values for this template", () => {
    const values = standInValues(TEMPLATE, {
      brief: "Make it shorter",
      templateIdHint: "tpl-1",
      followUp: {
        previousBrief: "x",
        drafts: [
          {
            templateId: "tpl-1",
            templateName: "Product launch",
            values: [{ fieldKey: "eyebrow", value: "Out today" }],
          },
        ],
      },
    });
    expect(values.eyebrow).toBe("Out today");
  });
});

describe("standInGenerate", () => {
  it("returns one proposal for the hinted template with a merged caption", async () => {
    const res = await build({
      brief: "Headline: Meet Acme Pro",
      templateIdHint: "tpl-1",
      details: [{ fieldKey: "headline", value: "Meet Acme Pro" }],
    });
    expect(res.proposals).toHaveLength(1);
    const [p] = res.proposals;
    expect(p.templateId).toBe("tpl-1");
    expect(p.values.headline).toBe("Meet Acme Pro");
    expect(p.caption).toBe("Meet Acme Pro Read the announcement");
    expect(p.imageFieldsNeeded).toEqual([
      { fieldKey: "image", label: "Product image", required: true },
    ]);
    expect(res.reply).toBeTruthy();
    expect(res.title).toBe("Product launch");
  });

  it("asks its question when the request allows one", async () => {
    const res = await build({ brief: "Build it", templateIdHint: "tpl-1", allowQuestion: true });
    expect(res.proposals).toEqual([]);
    expect(res.question).toBe(STAND_IN_QUESTION);
  });

  it("refuses another company's template", async () => {
    await expect(
      standInGenerate("co-2", { brief: "x", templateIdHint: "tpl-1" }, loaders),
    ).rejects.toThrow();
  });
});

describe("standInGenerate for Generate", () => {
  it("fills up to `count` published templates, titled from the brief", async () => {
    const res = await build({ brief: "Announce our new Denver studio. Opens Monday.", count: 2 });
    expect(res.proposals.map((p) => p.templateId)).toEqual(["tpl-1", "tpl-2"]);
    expect(res.title).toBe("Announce our new Denver studio");
    expect(res.reply).toBe("Here are 2 drafts from your templates.");
  });

  it("prefers templates serving the platform hint", async () => {
    const res = await build({ brief: "Hiring", count: 1, platformHint: "x" });
    expect(res.proposals.map((p) => p.templateId)).toEqual(["tpl-2"]);
  });

  it("keeps a follow-up's templates and values", async () => {
    const res = await build({
      brief: "Make it Friday",
      count: 3,
      followUp: {
        previousBrief: "x",
        drafts: [
          {
            templateId: "tpl-2",
            templateName: "Open role",
            values: [{ fieldKey: "eyebrow", value: "Out Friday" }],
          },
        ],
      },
    });
    expect(res.proposals).toHaveLength(1);
    expect(res.proposals[0].values.eyebrow).toBe("Out Friday");
    expect(res.title).toBeUndefined();
  });

  it("puts the photo in the first member image slot", async () => {
    const res = await build({ brief: "x", count: 1, hasImage: true });
    expect(res.proposals[0].imageTargetFieldKey).toBe("image");
  });

  it("refuses a new design", async () => {
    await expect(
      standInGenerate("co-1", { brief: "x", mode: "freestyle" }, loaders),
    ).rejects.toThrow(STAND_IN_REFUSAL);
  });

  it("stops when the chat aborts", async () => {
    const stop = new AbortController();
    const pending = standInGenerate(
      "co-1",
      { brief: "x", templateIdHint: "tpl-1" },
      loaders,
      stop.signal,
    );
    stop.abort();
    await expect(pending).rejects.toThrow();
  });
});

describe("standInRepair", () => {
  it("returns the values unchanged", () => {
    const res = standInRepair({
      templateId: "tpl-1",
      brief: "x",
      fields: [{ fieldKey: "headline", value: "Too long", characterBudget: 3 }],
    });
    expect(res.values).toEqual({ headline: "Too long" });
  });
});

describe("LocalGenerateProvider", () => {
  it("runs both chats in a development build", () => {
    expect(new LocalGenerateProvider().isConfigured()).toBe(true);
  });

  it("runs neither in a production build", async () => {
    vi.stubEnv("DEV", false);
    const provider = new LocalGenerateProvider();
    expect(provider.isConfigured()).toBe(false);
    await expect(
      provider.generate("co-1", { brief: "x", templateIdHint: "tpl-1" }),
    ).rejects.toThrow(/Supabase backend/);
  });
});
