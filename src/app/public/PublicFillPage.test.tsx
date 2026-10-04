// The public link page renders the fill page's form in its public
// configuration (new look, Phase 4). It reads an Edge Function, so it
// cannot render on the local backend; this test stands in for the
// screenshot loop there.

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { BrandKit, TemplateField, TemplateSchema } from "@/lib/types";
import type { PublicTemplate } from "@/lib/publicLink/client";
import { saveDraft } from "@/lib/publicLink/draft";

vi.mock("@/lib/publicLink/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/publicLink/client")>()),
  fetchPublicTemplate: vi.fn(),
  recordPublicDownload: vi.fn(),
  recordPublicShare: vi.fn(),
}));
// The canvas itself is the renderer's business, and happy-dom has none.
vi.mock("../components/SchemaRenderer", () => ({
  SchemaRenderer: React.forwardRef(function Stub() {
    return <div data-testid="graphic" />;
  }),
}));

const { fetchPublicTemplate } = await import("@/lib/publicLink/client");
const { PublicFillPage } = await import("./PublicFillPage");

const T0 = "2026-10-04T10:00:00.000Z";
const field = (fieldKey: string, over: Partial<TemplateField> = {}): TemplateField => ({
  id: fieldKey,
  label: fieldKey[0].toUpperCase() + fieldKey.slice(1),
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
  fields: [field("headline"), field("photo", { type: "image", optional: true })],
  captionTemplate: "{headline}",
  createdAt: T0,
  updatedAt: T0,
};
const payload = (over: Partial<PublicTemplate> = {}): PublicTemplate => ({
  template: TEMPLATE,
  brandKit: null as unknown as BrandKit,
  fontAssets: [],
  allowUploads: true,
  assetTtlSeconds: 3600,
  pinnedVariantId: null,
  ...over,
});

// Node's own localStorage global shadows the DOM's here; the draft gets an
// in-memory one.
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (k) => items.get(k) ?? null,
    key: (i) => [...items.keys()][i] ?? null,
    removeItem: (k) => void items.delete(k),
    setItem: (k, v) => void items.set(k, String(v)),
  };
}
beforeEach(() => {
  const storage = memoryStorage();
  vi.stubGlobal("localStorage", storage);
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
});
afterEach(() => {
  vi.mocked(fetchPublicTemplate).mockReset();
  vi.unstubAllGlobals();
});

describe("PublicFillPage", () => {
  it("renders the Details panel with no header buttons", async () => {
    vi.mocked(fetchPublicTemplate).mockResolvedValue(payload());
    render(<PublicFillPage token="tok" />);
    expect(await screen.findByRole("heading", { name: "Details" })).toBeTruthy();
    for (const name of ["Use AI to assist", "Bulk fill", "Public link"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Photo: Add a photo/ })).toBeTruthy();
  });

  it("offers no photo field when the link turns uploads off", async () => {
    vi.mocked(fetchPublicTemplate).mockResolvedValue(payload({ allowUploads: false }));
    render(<PublicFillPage token="tok" />);
    await screen.findByRole("heading", { name: "Details" });
    expect(screen.queryByRole("button", { name: /^Photo:/ })).toBeNull();
    expect(screen.getByLabelText("Headline")).toBeTruthy();
  });

  it("restores the visitor's draft", async () => {
    saveDraft("tok", TEMPLATE.fields, { headline: "Meet Acme Pro" });
    vi.mocked(fetchPublicTemplate).mockResolvedValue(payload());
    render(<PublicFillPage token="tok" />);
    const headline = (await screen.findByLabelText("Headline")) as HTMLInputElement;
    expect(headline.value).toBe("Meet Acme Pro");
    expect((screen.getByLabelText("Caption") as HTMLTextAreaElement).value).toBe("Meet Acme Pro");
  });
});
