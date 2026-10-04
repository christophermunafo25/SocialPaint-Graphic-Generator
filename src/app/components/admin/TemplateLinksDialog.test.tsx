// The Public links dialog's body (new look, 168:758): the form, the rows,
// and the confirmations that guard Revoke and New address.

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TemplateLink } from "@/lib/types";
import { PublicLinksBody } from "./TemplateLinksDialog";

const LINK: TemplateLink = {
  id: "link-1",
  templateId: "tpl",
  name: "Recruiting partners",
  allowUploads: true,
  pinnedVariantId: null,
  expiresAt: null,
  useCap: null,
  useCount: 37,
  revokedAt: null,
  createdAt: "2026-09-14T12:00:00.000Z",
  lastUsedAt: null,
} as TemplateLink;

function setup(over: Partial<React.ComponentProps<typeof PublicLinksBody>> = {}) {
  const props: React.ComponentProps<typeof PublicLinksBody> = {
    state: "ready",
    defaults: { allowUploads: true, expiryDays: null, useCap: null },
    links: [LINK],
    loadError: false,
    onRetryLoad: vi.fn(),
    busy: false,
    error: null,
    freshUrl: null,
    missingAssets: null,
    onCreate: vi.fn(),
    onRevoke: vi.fn(),
    onRegenerate: vi.fn(),
    onPin: vi.fn(),
    onToggleUploads: vi.fn(),
    ...over,
  };
  render(<PublicLinksBody {...props} />);
  return props;
}

describe("PublicLinksBody", () => {
  it("creates a link from the form", async () => {
    const props = setup();
    await userEvent.type(screen.getByLabelText("Name"), "Speakers");
    await userEvent.click(screen.getByRole("button", { name: "Create link" }));
    expect(props.onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Speakers", allowUploads: true, useCap: null }),
    );
  });

  it("shows a link's state and stats", () => {
    setup();
    expect(screen.getByText("Recruiting partners")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("37")).toBeTruthy();
  });

  it("asks before revoking", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: "Revoke" }));
    expect(props.onRevoke).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole("button", { name: "Revoke link" }));
    expect(props.onRevoke).toHaveBeenCalledWith(LINK);
  });

  it("shows a fresh address once, with Copy link focused", async () => {
    setup({ freshUrl: "https://example.test/l/abc" });
    expect(
      (screen.getByDisplayValue("https://example.test/l/abc") as HTMLInputElement).readOnly,
    ).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Copy link" }));
  });

  it("explains a backend with no links", () => {
    setup({ state: "unavailable" });
    expect(screen.queryByRole("button", { name: "Create link" })).toBeNull();
  });
});
