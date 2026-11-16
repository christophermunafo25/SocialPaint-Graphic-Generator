import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { SIZE_CATALOG } from "@/lib/templates/platforms";
import { SizeGallery, type SizesState } from "./SizeGallery";

const READY: SizesState = { status: "ready", sizes: SIZE_CATALOG };

function renderGallery(current: { width: number; height: number } | null = null) {
  const onPick = vi.fn();
  render(<SizeGallery state={READY} current={current} onPick={onPick} />);
  return onPick;
}

const covers = () =>
  screen
    .getAllByRole("button")
    .filter((b) => b.classList.contains("sp-size-cover"))
    .map((b) => b.getAttribute("aria-label") ?? "");

describe("Choose a size (329:2970)", () => {
  it("opens on Social media and picks a size by its cover", async () => {
    const onPick = renderGallery();
    const categories = screen.getByRole("radiogroup", { name: "Size category" });
    expect(
      within(categories).getByRole("radio", { name: "Social media" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(covers().length).toBeGreaterThan(4);
    await userEvent.click(screen.getByRole("button", { name: /^Portrait post for/ }));
    expect(onPick).toHaveBeenCalledWith({ width: 1080, height: 1350 });
  });

  it("is one tab stop for the categories, and the arrows move and choose", async () => {
    renderGallery();
    const categories = screen.getByRole("radiogroup", { name: "Size category" });
    const social = within(categories).getByRole("radio", { name: "Social media" });
    expect(social.tabIndex).toBe(0);
    expect(within(categories).getByRole("radio", { name: "Email" }).tabIndex).toBe(-1);
    social.focus();
    await userEvent.keyboard("{ArrowDown}");
    const email = within(categories).getByRole("radio", { name: "Email" });
    expect(email.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(email);
    expect(covers()).toEqual([expect.stringMatching(/^Email header for Email/)]);
  });

  it("marks the template's own size and doesn't offer it", async () => {
    const onPick = renderGallery({ width: 1080, height: 1920 });
    const own = screen.getByRole("button", { name: /1080 by 1920, the current size$/ });
    expect((own as HTMLButtonElement).disabled).toBe(true);
    expect(within(own).getByText("Current size")).toBeTruthy();
    await userEvent.click(own);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("narrows the covers by a search, and says when nothing matches", async () => {
    renderGallery();
    await userEvent.click(screen.getByRole("button", { name: "Search sizes" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search sizes" }), "story");
    await waitFor(() => expect(covers()).toEqual([expect.stringMatching(/^Story/)]));
    await userEvent.clear(screen.getByRole("searchbox", { name: "Search sizes" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search sizes" }), "zzz");
    expect(await screen.findByText("No sizes match that search.")).toBeTruthy();
  });

  it("takes a custom size once both sides are in bounds", async () => {
    const onPick = renderGallery();
    await userEvent.click(screen.getByRole("radio", { name: "Custom size" }));
    const width = screen.getByLabelText("Width");
    const height = screen.getByLabelText("Height");
    await userEvent.clear(width);
    expect(screen.getByRole("status").textContent).toBe("Enter both sides.");
    expect(
      (screen.getByRole("button", { name: "Use custom size" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await userEvent.type(width, "1200");
    await userEvent.clear(height);
    await userEvent.type(height, "900");
    await userEvent.click(screen.getByRole("button", { name: "Use 1200 × 900" }));
    expect(onPick).toHaveBeenCalledWith({ width: 1200, height: 900 });
  });

  it("offers Try again when the sizes don't load", async () => {
    const retry = vi.fn();
    render(<SizeGallery state={{ status: "error", retry }} onPick={() => {}} />);
    expect(screen.getByText("We couldn't load the sizes.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();
  });
});
