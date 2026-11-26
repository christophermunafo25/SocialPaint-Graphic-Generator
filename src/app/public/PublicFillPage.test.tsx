// The public link page renders the fill page's form in its public
// configuration (new look, Phase 4). It reads an Edge Function, so it
// cannot render on the local backend; this test stands in for the
// screenshot loop there.

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BrandKit, TemplateField, TemplateSchema } from "@/lib/types";
import type { PublicTemplate } from "@/lib/publicLink/client";
import { saveDraft } from "@/lib/publicLink/draft";

vi.mock("@/lib/publicLink/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/publicLink/client")>()),
  fetchPublicTemplate: vi.fn(),
  recordPublicDownload: vi.fn(),
  recordPublicShare: vi.fn(),
}));
// The canvas itself is the renderer's business, and happy-dom has none. Its
// export answers as a finished download would, once the gate (when a test
// sets one) opens.
const exportGate = vi.hoisted(() => ({ wait: null as Promise<void> | null }));
vi.mock("../components/SchemaRenderer", () => ({
  SchemaRenderer: React.forwardRef(function Stub(_props, ref) {
    React.useImperativeHandle(ref, () => ({
      exportPng: async () => {
        if (exportGate.wait) await exportGate.wait;
        return "downloaded";
      },
    }));
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
  exportGate.wait = null;
});

describe("PublicFillPage", () => {
  it("renders the Details panel with every field at once and no header buttons", async () => {
    vi.mocked(fetchPublicTemplate).mockResolvedValue(payload());
    render(<PublicFillPage token="tok" />);
    expect(await screen.findByRole("heading", { name: "Details" })).toBeTruthy();
    for (const name of ["Use AI to assist", "Bulk fill", "Public link"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    // The headline and the photo together, then Download PNG.
    expect(screen.getByLabelText("Headline")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Photo: Add a photo/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Download PNG/ })).toBeTruthy();
  });

  it("draws Download PNG as an enabled primary before the headline is in, and an early press marks it", async () => {
    vi.mocked(fetchPublicTemplate).mockResolvedValue(payload());
    render(<PublicFillPage token="tok" />);
    const download = await screen.findByRole("button", { name: /Download PNG/ });
    expect(download.getAttribute("data-kind")).toBe("primary");
    expect(download.getAttribute("aria-disabled")).toBeNull();
    await userEvent.click(download);
    const headline = screen.getByLabelText("Headline");
    expect(headline.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(headline);
    // No file was made, so the button is still Download PNG, still enabled.
    expect(download.isConnected).toBe(true);
    expect(download.getAttribute("aria-disabled")).toBeNull();
    await userEvent.type(headline, "Meet Acme Pro");
    expect(headline.getAttribute("aria-invalid")).not.toBe("true");
  });

  it("marks Download PNG aria-disabled only while the file is being made", async () => {
    let release!: () => void;
    exportGate.wait = new Promise<void>((resolve) => (release = resolve));
    vi.mocked(fetchPublicTemplate).mockResolvedValue(payload());
    render(<PublicFillPage token="tok" />);
    await userEvent.type(await screen.findByLabelText("Headline"), "Meet Acme Pro");
    const download = screen.getByRole("button", { name: /Download PNG/ });
    expect(download.getAttribute("aria-disabled")).toBeNull();
    await userEvent.click(download);
    const busy = screen.getByRole("button", { name: /Generating/ });
    expect(busy.getAttribute("aria-disabled")).toBe("true");
    expect(busy.getAttribute("aria-busy")).toBe("true");
    await act(async () => release());
    expect(await screen.findByRole("button", { name: "Download again" })).toBeTruthy();
  });

  it("swaps Download PNG for Download again and Post to LinkedIn once a file exists", async () => {
    vi.mocked(fetchPublicTemplate).mockResolvedValue(payload());
    render(<PublicFillPage token="tok" />);
    await userEvent.type(await screen.findByLabelText("Headline"), "Meet Acme Pro");
    await userEvent.click(screen.getByRole("button", { name: /Download PNG/ }));
    const again = await screen.findByRole("button", { name: "Download again" });
    expect(screen.getByRole("button", { name: "Post to LinkedIn" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Download PNG/ })).toBeNull();
    // The person's place moves on to the button that took Download PNG's.
    expect(document.activeElement).toBe(again);
  });

  it("keeps the download toast up for its time, and a second download restarts it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      vi.mocked(fetchPublicTemplate).mockResolvedValue(payload());
      render(<PublicFillPage token="tok" />);
      await user.type(await screen.findByLabelText("Headline"), "Meet Acme Pro");
      await user.click(screen.getByRole("button", { name: /Download PNG/ }));
      expect(await screen.findByText(/Graphic downloaded/)).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      await user.click(screen.getByRole("button", { name: "Download again" }));
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      // Past the first toast's 4000, the second keeps its own time.
      expect(screen.getByText(/Graphic downloaded/)).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      // Its time is up: it eases out, then unmounts.
      const leaving = screen.getByText(/Graphic downloaded/).closest(".ui-toast");
      expect(leaving?.hasAttribute("data-leaving")).toBe(true);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.queryByText(/Graphic downloaded/)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
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
