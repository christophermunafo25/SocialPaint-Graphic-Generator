import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { TemplateSchema } from "@/lib/types";
import { toCatalogTemplate } from "@/lib/templates/catalog";

// The preview is the renderer's business; the card's chrome is what is
// under test.
vi.mock("../TemplateThumbnail", () => ({
  TemplateThumbnail: () => <span data-testid="thumb" />,
}));

const { TemplateCard, cardMeta } = await import("./TemplateCard");

const T0 = "2026-11-25T10:00:00.000Z";
const schema = (variants?: TemplateSchema["variants"]): TemplateSchema => ({
  id: "tpl-1",
  companyId: "co-1",
  name: "Stat highlight",
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: 1080,
  canvasHeight: 1080,
  backgroundUrl: "",
  fields: [],
  captionTemplate: "",
  createdAt: T0,
  updatedAt: T0,
  variants,
});
const TWO_LOOKS: TemplateSchema["variants"] = [
  { id: "light", name: "Light", isDefault: true, overrides: {} },
  { id: "dark", name: "Dark", overrides: {} },
];

function stillMotion(still: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: still && query.includes("reduce"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("cardMeta", () => {
  it("is the size, plus the count when there are several variations", () => {
    expect(cardMeta(toCatalogTemplate(schema()))).toBe("1080 × 1080");
    expect(cardMeta(toCatalogTemplate(schema(TWO_LOOKS)))).toBe("1080 × 1080 · 2 variations");
  });

  it("names the variation showing in place of the count", () => {
    expect(cardMeta(toCatalogTemplate(schema(TWO_LOOKS)), "Dark")).toBe("1080 × 1080 · Dark");
    // A single-look template has no count to replace.
    expect(cardMeta(toCatalogTemplate(schema()), "Dark")).toBe("1080 × 1080");
  });
});

describe("TemplateCard", () => {
  it("is one button with nothing drawn over the preview and no go arrow", () => {
    stillMotion(false);
    const { container } = render(
      <TemplateCard template={toCatalogTemplate(schema(TWO_LOOKS))} onOpen={() => {}} />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(container.querySelector(".sp-tcard__go")).toBeNull();
    expect(container.querySelector(".sp-tcard__looks")).toBeNull();
    expect(container.querySelector(".ui-tag")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("names each variation in the size line while it steps, then returns to the count", () => {
    stillMotion(false);
    vi.useFakeTimers();
    const { container } = render(
      <TemplateCard template={toCatalogTemplate(schema(TWO_LOOKS))} onOpen={() => {}} />,
    );
    const size = () => container.querySelector(".sp-tcard__size")?.textContent;
    expect(size()).toBe("1080 × 1080 · 2 variations");
    fireEvent.mouseEnter(screen.getByRole("button"));
    expect(size()).toBe("1080 × 1080 · Dark");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(size()).toBe("1080 × 1080 · Light");
    fireEvent.mouseLeave(screen.getByRole("button"));
    expect(size()).toBe("1080 × 1080 · 2 variations");
  });

  it("holds the default and the count under reduced motion", () => {
    stillMotion(true);
    const { container } = render(
      <TemplateCard template={toCatalogTemplate(schema(TWO_LOOKS))} onOpen={() => {}} />,
    );
    fireEvent.focus(screen.getByRole("button"));
    expect(container.querySelector(".sp-tcard__size")?.textContent).toBe(
      "1080 × 1080 · 2 variations",
    );
  });
});
