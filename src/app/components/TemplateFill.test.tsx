// The fill page in the app (the member variant of TemplateFill). The public
// link renders the same component; PublicFillPage.test.tsx covers it there.

import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FieldValues, TemplateField, TemplateSchema } from "@/lib/types";

// The canvas is the renderer's business, and happy-dom has none. Its export
// answers as a finished download would, once the gate (when a test sets
// one) opens.
const exportGate = vi.hoisted(() => ({ wait: null as Promise<void> | null }));
vi.mock("./SchemaRenderer", () => ({
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

const { TemplateFill } = await import("./TemplateFill");

const T0 = "2026-11-25T10:00:00.000Z";
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
  fields: [field("headline")],
  captionTemplate: "{headline}",
  createdAt: T0,
  updatedAt: T0,
};

function FillPage() {
  const [values, setValues] = useState<FieldValues>({});
  return (
    <TemplateFill
      template={TEMPLATE}
      brandKit={null}
      values={values}
      onValuesChange={setValues}
      instrument={false}
    />
  );
}

afterEach(() => {
  exportGate.wait = null;
});

describe("TemplateFill, the fill page", () => {
  it("draws Download PNG as an enabled primary before the headline is in, and an early press marks it", async () => {
    render(<FillPage />);
    const download = screen.getByRole("button", { name: /Download PNG/ });
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
    render(<FillPage />);
    await userEvent.type(screen.getByLabelText("Headline"), "Meet Acme Pro");
    const download = screen.getByRole("button", { name: /Download PNG/ });
    expect(download.getAttribute("aria-disabled")).toBeNull();
    await userEvent.click(download);
    const busy = screen.getByRole("button", { name: /Generating/ });
    expect(busy.getAttribute("aria-disabled")).toBe("true");
    expect(busy.getAttribute("aria-busy")).toBe("true");
    await act(async () => release());
    expect(await screen.findByRole("button", { name: "Download again" })).toBeTruthy();
  });
});
