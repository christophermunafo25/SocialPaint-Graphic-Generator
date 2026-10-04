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

const get = async (id: string) => (id === TEMPLATE.id ? TEMPLATE : null);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** Runs a build past the stand-in's delay. */
async function build(input: Parameters<typeof standInGenerate>[1]) {
  vi.useFakeTimers();
  const pending = standInGenerate("co-1", input, get);
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

  it("refuses a request without a template hint", async () => {
    await expect(standInGenerate("co-1", { brief: "Anything" }, get)).rejects.toThrow(
      STAND_IN_REFUSAL,
    );
  });

  it("refuses another company's template", async () => {
    await expect(
      standInGenerate("co-2", { brief: "x", templateIdHint: "tpl-1" }, get),
    ).rejects.toThrow();
  });

  it("stops when the chat aborts", async () => {
    const stop = new AbortController();
    const pending = standInGenerate(
      "co-1",
      { brief: "x", templateIdHint: "tpl-1" },
      get,
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
  it("runs the template chat in a development build and Generate never", () => {
    const provider = new LocalGenerateProvider();
    expect(provider.isConfigured()).toBe(false);
    expect(provider.isTemplateChatAvailable()).toBe(true);
  });

  it("offers no template chat in a production build", async () => {
    vi.stubEnv("DEV", false);
    const provider = new LocalGenerateProvider();
    expect(provider.isTemplateChatAvailable()).toBe(false);
    await expect(
      provider.generate("co-1", { brief: "x", templateIdHint: "tpl-1" }),
    ).rejects.toThrow(STAND_IN_REFUSAL);
  });
});
